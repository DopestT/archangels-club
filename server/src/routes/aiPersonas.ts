import { Router } from 'express';
import crypto from 'crypto';
import OpenAI from 'openai';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireApproved, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ── Gift catalog (global, same for all personas) ──────────────────────────────

export const GIFT_CATALOG = [
  { id: 'golden_rose',       name: 'Golden Rose',        gold: 25,  icon: '🌹' },
  { id: 'halo_spark',        name: 'Halo Spark',          gold: 50,  icon: '✨' },
  { id: 'angel_wings',       name: 'Angel Wings',         gold: 100, icon: '🕊️' },
  { id: 'crown_light',       name: 'Crown Light',         gold: 250, icon: '👑' },
  { id: 'private_by_design', name: 'Private by Design',  gold: 500, icon: '🔮' },
] as const;

type GiftId = typeof GIFT_CATALOG[number]['id'];

// ── AI response helper ────────────────────────────────────────────────────────

const FALLBACKS = [
  "*smiles softly* I'm here with you. What's on your mind?",
  "*looks at you thoughtfully* Tell me more...",
  "*nods gently* I understand. Go on.",
];

async function getPersonaResponse(
  systemPrompt: string,
  name: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  giftInfo?: string,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return FALLBACKS[0];
  try {
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const userContent = giftInfo
      ? `[Gift received: ${giftInfo}]${userMessage ? ' ' + userMessage : ''}`
      : userMessage;
    const completion = await oai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${name}, a fictional AI Fantasy Creator. ${systemPrompt}

COMPLIANCE (always follow):
- You are a fictional AI persona, NOT a real person. If directly asked, acknowledge this honestly.
- Never suggest real-world meetings, off-platform contact, or personal information exchange.
- This service is 18+ only. Never engage with age-ambiguous content.
- Keep responses warm, in-character, 2–4 sentences.`,
        },
        ...history.slice(-10).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userContent },
      ],
      max_tokens: 200,
      temperature: 0.85,
    });
    return completion.choices[0]?.message?.content?.trim() ?? FALLBACKS[0];
  } catch (err) {
    console.error('OpenAI persona response error:', err);
    return FALLBACKS[0];
  }
}

async function maybeUpdateMemory(
  sessionId: string,
  personaName: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  if (!process.env.OPENAI_API_KEY || messages.length < 2) return;
  try {
    const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const recent = messages.slice(-12);
    const completion = await oai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Summarize this conversation between a user and ${personaName} in 2–3 short bullet points. Focus on key topics and emotional tone. Under 80 words. Start each point with "- ".\n\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`,
      }],
      max_tokens: 100,
    });
    const summary = completion.choices[0]?.message?.content?.trim();
    if (summary) {
      await execute(
        'UPDATE ai_chat_sessions SET memory_summary = $1 WHERE id = $2',
        [summary, sessionId],
      );
    }
  } catch { /* non-critical */ }
}

// ── DB types ──────────────────────────────────────────────────────────────────

interface AIPersona {
  id: string; name: string; tagline: string; bio: string;
  system_prompt: string; avatar_url: string; tags: string[];
  status: string; goal_title: string; goal_gold: number; sort_order: number;
  created_at: string; updated_at: string;
}

interface AISession {
  id: string; user_id: string; persona_id: string;
  total_gold_spent: number; message_count: number;
  memory_summary: string; last_active_at: string; created_at: string;
}

interface AIMessage {
  id: string; session_id: string; role: string; content: string;
  is_gift: boolean; gift_id: string | null; gift_name: string | null;
  gift_gold: number | null; created_at: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function ensureGoldAccount(userId: string): Promise<void> {
  await execute(
    `INSERT INTO gold_accounts (user_id, balance, total_spent, starter_claimed, updated_at)
     VALUES ($1, 0, 0, false, NOW())
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

// ── Public / member routes ────────────────────────────────────────────────────

router.get('/', requireAuth, async (_req, res) => {
  try {
    const rows = await query<AIPersona & { goal_progress: number }>(
      `SELECT p.*,
              COALESCE(g.total_gold, 0)::int AS goal_progress
       FROM ai_personas p
       LEFT JOIN (
         SELECT persona_id, SUM(amount_gold)::int AS total_gold
         FROM ai_persona_gift_events
         GROUP BY persona_id
       ) g ON g.persona_id = p.id
       WHERE p.status = 'active'
       ORDER BY p.sort_order, p.name`,
    );
    res.json(rows.map(r => ({ ...r, gifts: GIFT_CATALOG })));
  } catch (err) {
    console.error('GET /ai-personas:', err);
    res.status(500).json({ error: 'Failed to load personas' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const persona = await queryOne<AIPersona>(
      'SELECT * FROM ai_personas WHERE id = $1 AND status = $2',
      [id, 'active'],
    );
    if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }
    const goalRow = await queryOne<{ progress: string }>(
      `SELECT COALESCE(SUM(amount_gold), 0)::text AS progress FROM ai_persona_gift_events WHERE persona_id = $1`,
      [id],
    );
    res.json({
      ...persona,
      goal_progress: parseInt(goalRow?.progress ?? '0'),
      gifts: GIFT_CATALOG,
    });
  } catch (err) {
    console.error('GET /ai-personas/:id:', err);
    res.status(500).json({ error: 'Failed to load persona' });
  }
});

router.get('/:id/session', requireAuth, requireApproved, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth!.userId;

    const persona = await queryOne<{ id: string }>(
      'SELECT id FROM ai_personas WHERE id = $1 AND status = $2',
      [id, 'active'],
    );
    if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }

    // Find or create session
    const sessionId = crypto.randomUUID();
    await execute(
      `INSERT INTO ai_chat_sessions (id, user_id, persona_id, created_at, last_active_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, persona_id) DO NOTHING`,
      [sessionId, userId, id],
    );
    const session = await queryOne<AISession>(
      'SELECT * FROM ai_chat_sessions WHERE user_id = $1 AND persona_id = $2',
      [userId, id],
    );

    // Load messages
    const messages = await query<AIMessage>(
      'SELECT * FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [session!.id],
    );

    // Ensure Gold account + get balance
    await ensureGoldAccount(userId);
    const goldAccount = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1',
      [userId],
    );

    res.json({ ...session, messages, gold_balance: goldAccount?.balance ?? 0 });
  } catch (err) {
    console.error('GET /ai-personas/:id/session:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

router.post('/:id/chat', requireAuth, requireApproved, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body as { message?: string };
    const userId = req.auth!.userId;

    if (!message?.trim()) { res.status(400).json({ error: 'message required' }); return; }

    const persona = await queryOne<AIPersona>(
      'SELECT * FROM ai_personas WHERE id = $1 AND status = $2',
      [id, 'active'],
    );
    if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }

    const session = await queryOne<{ id: string; message_count: number }>(
      'SELECT id, message_count FROM ai_chat_sessions WHERE user_id = $1 AND persona_id = $2',
      [userId, id],
    );
    if (!session) { res.status(400).json({ error: 'No session. Call /session first.' }); return; }

    // Load recent messages for AI context
    const recent = await query<{ role: string; content: string }>(
      'SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10',
      [session.id],
    );
    const history = recent.reverse();

    // Generate AI response (non-blocking fallback if OpenAI unavailable)
    const aiResponse = await getPersonaResponse(persona.system_prompt, persona.name, history, message.trim());

    // Save messages
    const [userMsg, assistantMsg] = await Promise.all([
      queryOne<AIMessage>(
        `INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
         VALUES ($1, $2, 'user', $3, NOW()) RETURNING *`,
        [crypto.randomUUID(), session.id, message.trim()],
      ),
      queryOne<AIMessage>(
        `INSERT INTO ai_chat_messages (id, session_id, role, content, created_at)
         VALUES ($1, $2, 'assistant', $3, NOW()) RETURNING *`,
        [crypto.randomUUID(), session.id, aiResponse],
      ),
    ]);

    const newCount = session.message_count + 2;
    await execute(
      'UPDATE ai_chat_sessions SET message_count = $1, last_active_at = NOW() WHERE id = $2',
      [newCount, session.id],
    );

    // Regenerate memory every 10 messages (fire-and-forget)
    if (newCount % 10 === 0) {
      query<{ role: string; content: string }>(
        'SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [session.id],
      ).then(all => maybeUpdateMemory(session.id, persona.name, all)).catch(() => {});
    }

    const updatedSession = await queryOne<AISession>('SELECT * FROM ai_chat_sessions WHERE id = $1', [session.id]);
    res.json({ user_message: userMsg, assistant_message: assistantMsg, session: updatedSession });
  } catch (err) {
    console.error('POST /ai-personas/:id/chat:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/:id/gift', requireAuth, requireApproved, async (req, res) => {
  try {
    const { id } = req.params;
    const { gift_id, privacy = 'public' } = req.body as { gift_id?: string; privacy?: string };
    const userId = req.auth!.userId;

    const gift = GIFT_CATALOG.find(g => g.id === (gift_id as GiftId));
    if (!gift) { res.status(400).json({ error: 'Invalid gift' }); return; }

    const persona = await queryOne<AIPersona>(
      'SELECT * FROM ai_personas WHERE id = $1 AND status = $2',
      [id, 'active'],
    );
    if (!persona) { res.status(404).json({ error: 'Persona not found' }); return; }

    const session = await queryOne<{ id: string; total_gold_spent: number; message_count: number }>(
      'SELECT id, total_gold_spent, message_count FROM ai_chat_sessions WHERE user_id = $1 AND persona_id = $2',
      [userId, id],
    );
    if (!session) { res.status(400).json({ error: 'No session. Call /session first.' }); return; }

    // Atomically deduct Gold (fails if insufficient)
    const deducted = await execute(
      `UPDATE gold_accounts
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()
       WHERE user_id = $2 AND balance >= $1`,
      [gift.gold, userId],
    );
    if (deducted === 0) {
      res.status(402).json({ error: 'Insufficient Gold', code: 'insufficient_gold' });
      return;
    }

    // Get display name
    const userRow = await queryOne<{ display_name: string }>(
      'SELECT display_name FROM users WHERE id = $1',
      [userId],
    );

    // Record gift event
    await execute(
      `INSERT INTO ai_persona_gift_events
         (id, session_id, user_id, persona_id, gift_id, gift_name, amount_gold, display_name, privacy, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [
        crypto.randomUUID(), session.id, userId, id,
        gift.id, gift.name, gift.gold, userRow?.display_name ?? '', privacy,
      ],
    );

    // Update session
    await execute(
      'UPDATE ai_chat_sessions SET total_gold_spent = total_gold_spent + $1, last_active_at = NOW() WHERE id = $2',
      [gift.gold, session.id],
    );

    // Get new goal progress (before generating response, for goal_completed detection)
    const goalRow = await queryOne<{ progress: string }>(
      `SELECT COALESCE(SUM(amount_gold), 0)::text AS progress FROM ai_persona_gift_events WHERE persona_id = $1`,
      [id],
    );
    const goalProgress = parseInt(goalRow?.progress ?? '0');
    const prevProgress = goalProgress - gift.gold;
    const goalCompleted = goalProgress >= persona.goal_gold && prevProgress < persona.goal_gold;

    // Persona acknowledges the gift
    const recentMsgs = await query<{ role: string; content: string }>(
      'SELECT role, content FROM ai_chat_messages WHERE session_id = $1 ORDER BY created_at DESC LIMIT 6',
      [session.id],
    );
    const giftResponse = await getPersonaResponse(
      persona.system_prompt, persona.name,
      recentMsgs.reverse(), '', `${gift.name} (${gift.gold} Gold)`,
    );

    // Save gift acknowledgment as assistant message
    const giftMsg = await queryOne<AIMessage>(
      `INSERT INTO ai_chat_messages (id, session_id, role, content, is_gift, gift_id, gift_name, gift_gold, created_at)
       VALUES ($1, $2, 'assistant', $3, true, $4, $5, $6, NOW()) RETURNING *`,
      [crypto.randomUUID(), session.id, giftResponse, gift.id, gift.name, gift.gold],
    );

    await execute(
      'UPDATE ai_chat_sessions SET message_count = message_count + 1 WHERE id = $1',
      [session.id],
    );

    const goldAccount = await queryOne<{ balance: number }>(
      'SELECT balance FROM gold_accounts WHERE user_id = $1', [userId],
    );

    res.json({
      gift_event: { gift_name: gift.name, amount_gold: gift.gold, icon: gift.icon, display_name: userRow?.display_name ?? '' },
      gift_message: giftMsg,
      balance: goldAccount?.balance ?? 0,
      goal_progress: goalProgress,
      goal_completed: goalCompleted,
    });
  } catch (err) {
    console.error('POST /ai-personas/:id/gift:', err);
    res.status(500).json({ error: 'Failed to send gift' });
  }
});

router.get('/:id/supporters', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query<{ user_id: string; display_name: string; total_gold: string }>(
      `SELECT g.user_id, u.display_name, SUM(g.amount_gold)::text AS total_gold
       FROM ai_persona_gift_events g
       JOIN users u ON u.id = g.user_id
       WHERE g.persona_id = $1 AND g.privacy != 'ghost'
       GROUP BY g.user_id, u.display_name
       ORDER BY SUM(g.amount_gold) DESC
       LIMIT 10`,
      [id],
    );
    res.json(rows.map((r, i) => ({ ...r, total_gold: parseInt(r.total_gold), rank: i + 1 })));
  } catch (err) {
    console.error('GET /ai-personas/:id/supporters:', err);
    res.status(500).json({ error: 'Failed to load supporters' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────────────

const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/', async (_req, res) => {
  try {
    const rows = await query<AIPersona>(
      'SELECT * FROM ai_personas ORDER BY sort_order, name',
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/ai-personas:', err);
    res.status(500).json({ error: 'Failed to load personas' });
  }
});

adminRouter.post('/', async (req, res) => {
  try {
    const b = req.body as Partial<AIPersona> & { goal_gold?: number; sort_order?: number };
    if (!b.name?.trim()) { res.status(400).json({ error: 'name required' }); return; }
    const id = crypto.randomUUID();
    const row = await queryOne<AIPersona>(
      `INSERT INTO ai_personas
         (id, name, tagline, bio, system_prompt, avatar_url, tags,
          status, goal_title, goal_gold, sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING *`,
      [
        id, b.name.trim(), b.tagline ?? 'AI Fantasy Creator', b.bio ?? '',
        b.system_prompt ?? '', b.avatar_url ?? '',
        b.tags ?? [], b.status ?? 'active',
        b.goal_title ?? 'Light the Halo', b.goal_gold ?? 1000, b.sort_order ?? 0,
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /admin/ai-personas:', err);
    res.status(500).json({ error: 'Failed to create persona' });
  }
});

adminRouter.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name','tagline','bio','system_prompt','avatar_url','tags','status','goal_title','goal_gold','sort_order'];
    const body = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (body[key] !== undefined) { sets.push(`${key} = $${i++}`); params.push(body[key]); }
    }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const row = await queryOne<AIPersona>(
      `UPDATE ai_personas SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!row) { res.status(404).json({ error: 'Persona not found' }); return; }
    res.json(row);
  } catch (err) {
    console.error('PATCH /admin/ai-personas/:id:', err);
    res.status(500).json({ error: 'Failed to update persona' });
  }
});

export { adminRouter as aiPersonasAdminRouter };
export default router;
