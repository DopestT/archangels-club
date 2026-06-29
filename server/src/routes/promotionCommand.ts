import { Router } from 'express';
import crypto from 'crypto';
import { query, queryOne, execute } from '../db/schema.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ── Campaigns ─────────────────────────────────────────────────────────────────

router.get('/campaigns', async (_req, res) => {
  try {
    const rows = await query<Record<string, unknown>>(`
      SELECT
        c.id, c.name, c.goal, c.week, c.status, c.created_at, c.updated_at,
        COUNT(p.id)::int                                               AS total_posts,
        COUNT(p.id) FILTER (WHERE p.status = 'draft')::int            AS draft_count,
        COUNT(p.id) FILTER (WHERE p.status = 'approved')::int         AS approved_count,
        COUNT(p.id) FILTER (WHERE p.status = 'posted')::int           AS posted_count,
        COALESCE(SUM(p.creator_apps)     FILTER (WHERE p.status = 'posted'), 0)::int AS creator_leads,
        COALESCE(SUM(p.waitlist_signups) FILTER (WHERE p.status = 'posted'), 0)::int AS waitlist_clicks
      FROM promotion_campaigns c
      LEFT JOIN promotion_posts p ON p.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/promotion/campaigns:', err);
    res.status(500).json({ error: 'Failed to load campaigns' });
  }
});

router.post('/campaigns', async (req, res) => {
  try {
    const { name, goal = '', week = '' } = req.body as { name?: string; goal?: string; week?: string };
    if (!name?.trim()) { res.status(400).json({ error: 'Campaign name is required' }); return; }
    const id = crypto.randomUUID();
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO promotion_campaigns (id, name, goal, week, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`,
      [id, name.trim(), goal.trim(), week.trim()],
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /admin/promotion/campaigns:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

router.patch('/campaigns/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, string>;
    const allowed = ['name', 'goal', 'week', 'status'];
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (body[key] !== undefined) { sets.push(`${key} = $${i++}`); params.push(body[key]); }
    }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE promotion_campaigns SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!row) { res.status(404).json({ error: 'Campaign not found' }); return; }
    res.json(row);
  } catch (err) {
    console.error('PATCH /admin/promotion/campaigns/:id:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// ── Posts ─────────────────────────────────────────────────────────────────────

router.get('/posts', async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const conds: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (q.campaign_id) { conds.push(`campaign_id = $${i++}`); params.push(q.campaign_id); }
    if (q.status)      { conds.push(`status = $${i++}`);      params.push(q.status); }
    if (q.platform)    { conds.push(`platform = $${i++}`);    params.push(q.platform); }
    if (q.audience_type) { conds.push(`audience_type = $${i++}`); params.push(q.audience_type); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = await query<Record<string, unknown>>(
      `SELECT * FROM promotion_posts ${where} ORDER BY created_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /admin/promotion/posts:', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

router.post('/posts', async (req, res) => {
  try {
    const b = req.body as Record<string, string>;
    const id = crypto.randomUUID();
    const row = await queryOne<Record<string, unknown>>(
      `INSERT INTO promotion_posts
         (id, campaign_id, post_type, platform, audience_type, hook, caption,
          hashtags, cta, asset_description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [
        id,
        b.campaign_id || null,
        b.post_type || 'post',
        b.platform || 'instagram',
        b.audience_type || 'member',
        b.hook || '',
        b.caption || '',
        b.hashtags || '',
        b.cta || '',
        b.asset_description || '',
      ],
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /admin/promotion/posts:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.patch('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const allowed = [
      'post_type','platform','audience_type','hook','caption','hashtags',
      'cta','asset_description','status','scheduled_for','posted_at',
      'admin_notes','views','likes','comments','shares','clicks',
      'creator_apps','waitlist_signups','tracking_notes',
    ];
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (body[key] !== undefined) { sets.push(`${key} = $${i++}`); params.push(body[key]); }
    }
    if (!sets.length) { res.status(400).json({ error: 'Nothing to update' }); return; }
    if (body.status === 'posted' && body.posted_at === undefined) {
      sets.push(`posted_at = NOW()`);
    }
    sets.push(`updated_at = NOW()`);
    params.push(id);
    const row = await queryOne<Record<string, unknown>>(
      `UPDATE promotion_posts SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    );
    if (!row) { res.status(404).json({ error: 'Post not found' }); return; }
    res.json(row);
  } catch (err) {
    console.error('PATCH /admin/promotion/posts/:id:', err);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const count = await execute('DELETE FROM promotion_posts WHERE id = $1', [id]);
    if (count === 0) { res.status(404).json({ error: 'Post not found' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /admin/promotion/posts/:id:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// ── Generate Pack ─────────────────────────────────────────────────────────────

interface PostTemplate {
  post_type: string;
  platform: string;
  audience_type: string;
  hook: string;
  caption: string;
  hashtags: string;
  cta: string;
  asset_description: string;
}

function getPromoTemplates(): PostTemplate[] {
  return [
    // ── 5 Member posts ──────────────────────────────────────────────────────
    {
      post_type: 'post', platform: 'instagram', audience_type: 'member',
      hook: "The private creator platform that doesn't play by the usual rules.",
      caption: "Archangels Club is invite-only — built for people who actually want to support the creators they love, not just scroll past them. Real content. Real connections. No algorithm noise.\n\nMembership is selective and spots open up rarely. If you've been waiting for something worth your attention — this is it.",
      hashtags: '#ArchangelsClub #ExclusiveContent #CreatorSupport #MembersOnly #InviteOnly',
      cta: 'Apply for access at archangelsclub.com',
      asset_description: "Dark-themed carousel showing blurred platform UI — tease the aesthetic, don't reveal sensitive content",
    },
    {
      post_type: 'post', platform: 'tiktok', audience_type: 'member',
      hook: "I joined an invite-only platform and it actually changed how I consume content.",
      caption: "No endless scrolling. No algorithm pushing random stuff. Just the creators I chose to support — and content they actually put effort into. Archangels Club is different. Link in bio if you want to request access.",
      hashtags: '#ArchangelsClub #ContentCreators #ExclusiveAccess #RealContent',
      cta: 'Request access — link in bio',
      asset_description: 'POV-style video of first-time platform experience (no sensitive content shown)',
    },
    {
      post_type: 'post', platform: 'twitter', audience_type: 'member',
      hook: "Not every platform is built for everyone. Some are built for people who actually care.",
      caption: "Archangels Club is an invite-only creator platform. We're not trying to be the biggest — just the best. If you've ever wanted to support a creator directly, without the middleman noise, this is it.\n\nApplying is simple. Being part of it is worth it.",
      hashtags: '#ArchangelsClub #CreatorEconomy #InviteOnly',
      cta: 'archangelsclub.com — apply for membership',
      asset_description: 'Screenshot of clean platform UI with gold accents',
    },
    {
      post_type: 'post', platform: 'instagram', audience_type: 'member',
      hook: "The waitlist is real. The platform is worth it.",
      caption: "We've been quietly building something for people who are tired of one-size-fits-all social media. Archangels Club is a members-only space where creators and fans actually connect — beyond the feed.\n\nSpots open on a rolling basis. Request yours.",
      hashtags: '#ArchangelsClub #MembersOnly #CreatorPlatform #ExclusiveAccess #PrivateCommunity',
      cta: 'Join the waitlist — archangelsclub.com',
      asset_description: '"By Invitation Only" gold-themed minimal graphic on dark background',
    },
    {
      post_type: 'post', platform: 'facebook', audience_type: 'member',
      hook: "There's a better way to support the creators you actually love.",
      caption: "Archangels Club is a private, members-only creator platform. No public feed, no algorithm drama — just direct access to the creators you choose to support.\n\nWe open membership in small batches. If you want in, this is your window.",
      hashtags: '#ArchangelsClub #SupportCreators #MembersOnly #ExclusivePlatform',
      cta: 'Request access at archangelsclub.com',
      asset_description: 'Lifestyle photo paired with platform logo — clean, upscale aesthetic',
    },
    // ── 5 Creator posts ─────────────────────────────────────────────────────
    {
      post_type: 'post', platform: 'instagram', audience_type: 'creator',
      hook: "Your content deserves a platform that actually protects it.",
      caption: "Archangels Club is a members-only creator platform built for people who take their work seriously. Verified fans. Real earnings. A team that's on your side.\n\nWe're accepting a limited number of creator applications. If you've been looking for a platform that respects your work — this is it.",
      hashtags: '#ArchangelsClub #CreatorFirst #ContentCreator #CreatorEconomy #MonetizeYourContent',
      cta: 'Apply to become a creator — archangelsclub.com',
      asset_description: 'Creator at their setup — authentic, not over-produced',
    },
    {
      post_type: 'post', platform: 'tiktok', audience_type: 'creator',
      hook: "I wish I knew about this platform sooner.",
      caption: "Archangels Club isn't like other platforms. No algorithm deciding who sees your work. No competing with millions of accounts. Just your audience, your content, your terms.\n\nCreator applications are open for a limited time. Link in bio.",
      hashtags: '#ArchangelsClub #CreatorTips #ContentCreatorLife #TikTokCreator #CreatorPlatform',
      cta: 'Apply as a creator — link in bio',
      asset_description: 'Creator talking directly to camera — casual, genuine tone',
    },
    {
      post_type: 'post', platform: 'twitter', audience_type: 'creator',
      hook: "Platform ownership > platform renting.",
      caption: "On most platforms, the algorithm owns your audience. On Archangels Club, you do.\n\nInvite-only members. Direct monetization. A support team that actually responds. Creator applications are open — but we're selective for a reason.",
      hashtags: '#ArchangelsClub #CreatorEconomy #ContentMonetization #CreatorOwnership',
      cta: 'Apply at archangelsclub.com',
      asset_description: 'Clean text-based graphic with gold branding',
    },
    {
      post_type: 'post', platform: 'instagram', audience_type: 'creator',
      hook: "What if your fanbase was actually yours?",
      caption: "The algorithm doesn't own your audience on Archangels Club. Your subscribers chose you — not a feed. That's why creators here build real, lasting connections.\n\nWe're opening a small batch of creator spots.",
      hashtags: '#ArchangelsClub #CreatorSpace #YourAudience #ContentCreator',
      cta: 'Apply as a creator — archangelsclub.com',
      asset_description: 'Vertical story graphic — gold gradient, minimalist text',
    },
    {
      post_type: 'post', platform: 'linkedin', audience_type: 'creator',
      hook: "The creator economy is maturing — and Archangels Club is building the infrastructure for what comes next.",
      caption: "Archangels Club is a members-only creator platform with a simple philosophy: verified creators deserve verified fans.\n\nWe're accepting applications from professional content creators who want a sustainable, direct-revenue model.",
      hashtags: '#ArchangelsClub #CreatorEconomy #ContentStrategy #DigitalCreators',
      cta: 'Apply as a creator at archangelsclub.com',
      asset_description: 'Professional behind-the-scenes creation content',
    },
    // ── 3 TikTok scripts ────────────────────────────────────────────────────
    {
      post_type: 'script', platform: 'tiktok', audience_type: 'general',
      hook: "I found a platform that doesn't make me feel gross about what I'm watching.",
      caption: "[0–3s] Text overlay: \"POV: Found the most exclusive creator platform\"\n[3–8s] \"Okay so I've been on basically every platform — and they all have the same problem.\"\n[8–14s] \"Either the algorithm buries good content, or you're sifting through stuff with zero quality control.\"\n[14–20s] \"Archangels Club is different. Invite-only — creators are vetted, members chose to be there.\"\n[20–25s] \"I actually look forward to checking it. That's rare.\"\n[25–30s] \"Link in bio if you want to request access.\"",
      hashtags: '#ArchangelsClub #InviteOnly #CreatorContent #TikTok',
      cta: 'Link in bio — request access',
      asset_description: 'Talking-head video, casual home setting, ~30 seconds',
    },
    {
      post_type: 'script', platform: 'tiktok', audience_type: 'creator',
      hook: "Why are platform algorithms so scared of quality content?",
      caption: "[0–3s] Reaction to phone — frustrated expression\n[3–8s] \"I've been a creator for [X] years. The algorithm is not your friend.\"\n[8–14s] \"Doesn't matter how good your content is — constant posting, trending games, keyword prayers.\"\n[14–21s] \"That's why I found Archangels Club. Subscribers actually see your content. You set your rates.\"\n[21–26s] \"Creator apps are open — link's in bio. Selective, so don't sleep.\"\n[26–30s] Text overlay: \"archangelsclub.com\"",
      hashtags: '#ArchangelsClub #CreatorTips #AlgorithmProblems #ContentCreator',
      cta: 'Apply as a creator — link in bio',
      asset_description: 'Creator talking to camera, frustration-to-solution arc, ~30 seconds',
    },
    {
      post_type: 'script', platform: 'tiktok', audience_type: 'general',
      hook: "3 reasons the creator economy is broken — and one platform fixing it.",
      caption: "[0–3s] Text on screen: \"3 reasons the creator economy is broken\"\n[3–8s] \"One: you don't own your audience. The platform does.\"\n[8–14s] \"Two: monetization is inconsistent — ad revenue, sporadic sponsorships, tip pennies.\"\n[14–21s] \"Three: no quality filter. Your content fights everyone.\"\n[21–27s] \"Archangels Club: invite-only membership. Direct revenue. Verified creators.\"\n[27–30s] \"Link in bio — apply or request access.\"",
      hashtags: '#ArchangelsClub #CreatorEconomy #ContentCreator #TikTok',
      cta: 'archangelsclub.com — apply or request access',
      asset_description: 'List-style talking-head or text-overlay video, ~30 seconds',
    },
    // ── 3 Countdown posts ────────────────────────────────────────────────────
    {
      post_type: 'countdown', platform: 'instagram', audience_type: 'general',
      hook: "Applications close soon. This one's worth it.",
      caption: "We're wrapping up this batch of Archangels Club applications in the next few days.\n\nWe review every application personally. We're not chasing numbers — we're building a community.\n\nIf you've been considering it, now is the time.",
      hashtags: '#ArchangelsClub #LastChance #MembersOnly #InviteOnly #CreatorPlatform',
      cta: 'Apply now — archangelsclub.com',
      asset_description: 'Minimalist countdown graphic — gold numbers on dark background',
    },
    {
      post_type: 'countdown', platform: 'tiktok', audience_type: 'general',
      hook: "We're closing this application window in 48 hours.",
      caption: "Archangels Club reviews applications in batches. This window closes soon.\n\nLots of great applicants this round. If you haven't applied yet — now's the time. No guarantees we open again soon. Link in bio.",
      hashtags: '#ArchangelsClub #ApplicationClosing #InviteOnly #CreatorPlatform',
      cta: 'Apply — link in bio',
      asset_description: 'Text-to-camera with clear, direct urgency — no panic, just clarity',
    },
    {
      post_type: 'countdown', platform: 'instagram', audience_type: 'general',
      hook: "Limited spots. Final reminder.",
      caption: "This is the last reminder about this application window.\n\nArchangels Club is selective because we want it to stay good. Creator or member — apply before this window closes.\n\nWe'll announce when the next window opens. It won't be soon.",
      hashtags: '#ArchangelsClub #FinalReminder #MembersOnly #CreatorApplication #InviteOnly',
      cta: 'archangelsclub.com — final call',
      asset_description: '"By Invitation Only" gold border graphic on dark background',
    },
    // ── 3 Outreach messages ──────────────────────────────────────────────────
    {
      post_type: 'outreach', platform: 'other', audience_type: 'creator',
      hook: 'Personal DM: Creator invitation',
      caption: "Hey [Name],\n\nI've been following your work for a while and genuinely respect what you create. I wanted to reach out about Archangels Club — it's an invite-only creator platform for people who take their content seriously.\n\nWe're selective about who we bring on as creators, and I thought of you because [specific reason].\n\nNo pressure at all — just wanted to share it in case it's something you'd be interested in. Happy to answer any questions.\n\n— [Your name]",
      hashtags: '',
      cta: 'archangelsclub.com — creator application',
      asset_description: 'Send as personal DM — no graphic needed',
    },
    {
      post_type: 'outreach', platform: 'other', audience_type: 'member',
      hook: 'Personal DM: Member invitation',
      caption: "Hey [Name],\n\nHope things are going well! Wanted to let you know about Archangels Club — it's a new invite-only platform for people who want direct access to the creators they actually love.\n\nWe're opening a small batch of member spots and I thought you might be interested. It's not public — you have to be invited or apply directly.\n\nFeel free to ignore this if it's not your thing, but I'm happy to share more details.\n\n[Your name]",
      hashtags: '',
      cta: 'archangelsclub.com',
      asset_description: 'Send as personal DM — no graphic needed',
    },
    {
      post_type: 'outreach', platform: 'other', audience_type: 'general',
      hook: 'Follow-up: Waitlist update',
      caption: "Hey [Name],\n\nQuick update — we're reviewing the current waitlist this week. You applied for access a while back and I wanted to make sure you're still interested.\n\nIf you are, no action needed — we'll be in touch soon. If you have updates to add, now's a good time to reach out.\n\nThanks for your patience — we're keeping the community small on purpose.\n\n— Archangels Club Team",
      hashtags: '',
      cta: 'Reply to this message or visit archangelsclub.com',
      asset_description: 'Send as personal DM or email — no graphic needed',
    },
  ];
}

router.post('/generate', async (req, res) => {
  try {
    const { campaign_id } = req.body as { campaign_id?: string };
    if (!campaign_id) { res.status(400).json({ error: 'campaign_id required' }); return; }
    const campaign = await queryOne<{ id: string }>('SELECT id FROM promotion_campaigns WHERE id = $1', [campaign_id]);
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return; }

    const templates = getPromoTemplates();
    for (const t of templates) {
      const id = crypto.randomUUID();
      await execute(
        `INSERT INTO promotion_posts
           (id, campaign_id, post_type, platform, audience_type, hook, caption,
            hashtags, cta, asset_description, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
        [id, campaign_id, t.post_type, t.platform, t.audience_type,
         t.hook, t.caption, t.hashtags, t.cta, t.asset_description],
      );
    }
    res.json({ generated: templates.length, campaign_id });
  } catch (err) {
    console.error('POST /admin/promotion/generate:', err);
    res.status(500).json({ error: 'Failed to generate pack' });
  }
});

// ── Performance Summary ───────────────────────────────────────────────────────

router.get('/summary', async (req, res) => {
  try {
    const { campaign_id } = req.query as { campaign_id?: string };
    const cond = campaign_id ? `campaign_id = $1 AND` : '';
    const args = campaign_id ? [campaign_id] : [];

    const [bestHook, platforms, audiences, highestClick, highestCreatorApp, followUp] = await Promise.all([
      queryOne<{ hook: string; clicks: number; id: string }>(
        `SELECT hook, clicks, id FROM promotion_posts WHERE ${cond} status = 'posted' ORDER BY clicks DESC LIMIT 1`,
        args,
      ),
      query<{ platform: string; eng: string }>(
        `SELECT platform, SUM(views+likes+comments+shares+clicks)::text AS eng FROM promotion_posts WHERE ${cond} status = 'posted' GROUP BY platform ORDER BY SUM(views+likes+comments+shares+clicks) DESC LIMIT 1`,
        args,
      ),
      query<{ audience_type: string; eng: string }>(
        `SELECT audience_type, SUM(views+likes+comments+shares+clicks)::text AS eng FROM promotion_posts WHERE ${cond} status = 'posted' GROUP BY audience_type ORDER BY SUM(views+likes+comments+shares+clicks) DESC LIMIT 1`,
        args,
      ),
      queryOne<Record<string, unknown>>(
        `SELECT * FROM promotion_posts WHERE ${cond} status = 'posted' ORDER BY clicks DESC LIMIT 1`,
        args,
      ),
      queryOne<Record<string, unknown>>(
        `SELECT * FROM promotion_posts WHERE ${cond} status = 'posted' ORDER BY creator_apps DESC LIMIT 1`,
        args,
      ),
      query<Record<string, unknown>>(
        `SELECT * FROM promotion_posts WHERE ${cond} status = 'posted' AND (clicks > 0 OR creator_apps > 0) AND tracking_notes = '' ORDER BY clicks DESC LIMIT 10`,
        args,
      ),
    ]);

    res.json({
      best_hook: bestHook ? { hook: bestHook.hook, clicks: bestHook.clicks, post_id: bestHook.id } : null,
      best_platform: platforms[0] ? { platform: platforms[0].platform, total_engagement: Number(platforms[0].eng) } : null,
      best_audience: audiences[0] ? { audience_type: audiences[0].audience_type, total_engagement: Number(audiences[0].eng) } : null,
      highest_click_post: highestClick,
      highest_creator_app_post: highestCreatorApp,
      follow_up_needed: followUp,
    });
  } catch (err) {
    console.error('GET /admin/promotion/summary:', err);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

export default router;
