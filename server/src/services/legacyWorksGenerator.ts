import OpenAI from 'openai';
import { query, queryOne, execute } from '../db/schema.js';
import { buildEpub } from './epubBuilder.js';

// ── AI helpers ────────────────────────────────────────────────────────────────

function openai() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function chatJSON(prompt: string, maxTokens = 800): Promise<unknown> {
  const completion = await openai().chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  return JSON.parse(raw);
}

async function chatText(systemPrompt: string, userPrompt: string, maxTokens = 3000): Promise<string> {
  const completion = await openai().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

// ── DB helpers ────────────────────────────────────────────────────────────────

interface LwBook {
  id: string;
  title: string;
  subtitle: string;
  series_name: string;
  series_number: number | null;
  genre: string;
  subgenre: string;
  target_audience: string;
  word_count_target: number;
  word_count_actual: number;
  status: string;
  pipeline_stage: string;
  pipeline_progress: number;
  pipeline_error: string | null;
  bisac_primary: string;
  bisac_secondary: string;
  keywords: string;
  description: string;
  author_name: string;
  price_usd: string;
  ai_disclosure: boolean;
  epub_base64: string | null;
  niche_score: string | null;
  niche_notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LwChapter {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
  outline: string;
  content: string;
  word_count: number;
  status: string;
}

async function updateBook(id: string, fields: Partial<Record<string, unknown>>) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  await execute(
    `UPDATE lw_books SET ${sets}, updated_at = NOW() WHERE id = $1`,
    [id, ...Object.values(fields)]
  );
}

// ── Niche research ────────────────────────────────────────────────────────────

export interface NicheResearchResult {
  id: string;
  genre: string;
  profitability_score: number;
  competition_score: number;
  demand_score: number;
  recommended_price: number;
  keyword_suggestions: string[];
  title_hooks: string[];
  notes: string;
}

export async function researchNiche(genre: string, topic: string): Promise<NicheResearchResult> {
  const prompt = `You are an Amazon KDP market research expert for Legacy Works Publishing.

Analyze this publishing niche for profitability on Amazon KDP in 2026:
Genre: ${genre}
Topic/Focus: ${topic}

Consider: Amazon BSR patterns, keyword competition, buyer intent, series potential, pricing sweet spots, AI disclosure requirements.

Return JSON with these exact fields:
{
  "profitability_score": <0-100, weighted composite>,
  "competition_score": <0-100, higher = more competition>,
  "demand_score": <0-100, higher = more demand>,
  "recommended_price": <ideal USD price, e.g. 4.99>,
  "keyword_suggestions": [<7 Amazon backend keyword phrases>],
  "title_hooks": [<5 compelling title angle ideas>],
  "notes": "<2-3 sentences on opportunity and risks>"
}`;

  const result = await chatJSON(prompt, 900) as {
    profitability_score: number;
    competition_score: number;
    demand_score: number;
    recommended_price: number;
    keyword_suggestions: string[];
    title_hooks: string[];
    notes: string;
  };

  const id = crypto.randomUUID();
  await execute(
    `INSERT INTO lw_niche_research
       (id, query, genre, profitability_score, competition_score, demand_score,
        recommended_price, keyword_suggestions, title_hooks, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id, topic, genre,
      result.profitability_score, result.competition_score, result.demand_score,
      result.recommended_price,
      JSON.stringify(result.keyword_suggestions ?? []),
      JSON.stringify(result.title_hooks ?? []),
      result.notes ?? '',
    ]
  );

  return { id, genre, ...result };
}

// ── Blueprint generation ──────────────────────────────────────────────────────

export interface Blueprint {
  title: string;
  subtitle: string;
  chapters: { number: number; title: string; outline: string; word_count: number }[];
  target_audience: string;
  bisac_primary: string;
  bisac_secondary: string;
  series_potential: string;
}

export async function generateBlueprint(
  genre: string,
  topic: string,
  wordCountTarget: number,
  existingTitle?: string
): Promise<Blueprint> {
  const chapterCount = Math.max(5, Math.round(wordCountTarget / 3500));

  const prompt = `You are a professional book architect for Legacy Works Publishing, specializing in Amazon KDP ebooks.

Create a complete blueprint for an ebook:
Genre: ${genre}
Topic: ${topic}
${existingTitle ? `Working title: ${existingTitle}` : ''}
Target word count: ${wordCountTarget.toLocaleString()} words
Chapters needed: ${chapterCount}

Design a compelling, commercially viable book structure for 2026 Amazon readers.
Each chapter should have a clear purpose and roughly ${Math.round(wordCountTarget / chapterCount).toLocaleString()} words.

Return JSON:
{
  "title": "<compelling, SEO-friendly title>",
  "subtitle": "<subtitle that clarifies value proposition>",
  "target_audience": "<specific reader profile in 1 sentence>",
  "bisac_primary": "<BISAC code like 'SEL027000'>",
  "bisac_secondary": "<BISAC code>",
  "series_potential": "<brief note on series potential>",
  "chapters": [
    {
      "number": 1,
      "title": "<chapter title>",
      "outline": "<3-4 bullet points of what this chapter covers>",
      "word_count": <target word count for this chapter>
    }
  ]
}`;

  const result = await chatJSON(prompt, 1500) as Blueprint;
  return result;
}

// ── Chapter generation ────────────────────────────────────────────────────────

export async function generateChapter(
  book: LwBook,
  chapter: LwChapter,
  previousChapterSummaries: string[]
): Promise<string> {
  const systemPrompt = `You are a professional ghostwriter working for Legacy Works Publishing.
You write engaging, well-structured nonfiction/fiction for Amazon KDP readers.
Write in a clear, authoritative voice appropriate for the genre.
Never use filler phrases like "In conclusion" or "As we discussed".
Use varied sentence lengths. Include concrete examples, stories, or actionable advice.
Write approximately ${Math.round(book.word_count_target / Math.max(1, previousChapterSummaries.length + 1))} words for this chapter.`;

  const contextSummary = previousChapterSummaries.length > 0
    ? `\n\nPrevious chapters covered:\n${previousChapterSummaries.map((s, i) => `- Chapter ${i + 1}: ${s}`).join('\n')}`
    : '';

  const userPrompt = `Write Chapter ${chapter.chapter_number}: "${chapter.title}"

Book: "${book.title}${book.subtitle ? ': ' + book.subtitle : ''}"
Genre: ${book.genre}
Target audience: ${book.target_audience}

Chapter outline:
${chapter.outline}
${contextSummary}

Write the full chapter now. Start directly with the content — no meta-commentary about what you're writing. Do not include the chapter number or "Chapter X:" prefix in the text.`;

  return chatText(systemPrompt, userPrompt, 3500);
}

// ── Metadata package generation ───────────────────────────────────────────────

export interface MetadataPackage {
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
  bisac_primary: string;
  bisac_secondary: string;
  price_usd: number;
}

export async function generateMetadataPackage(book: LwBook, chapters: LwChapter[]): Promise<MetadataPackage> {
  const chapterTitles = chapters.map(c => `${c.chapter_number}. ${c.title}`).join('\n');

  const prompt = `You are an Amazon KDP metadata optimization expert for Legacy Works Publishing.

Book details:
Title: ${book.title}
Subtitle: ${book.subtitle}
Genre: ${book.genre}
Target audience: ${book.target_audience}
Current BISAC: ${book.bisac_primary}, ${book.bisac_secondary}
Chapter titles:
${chapterTitles}

Generate an optimized KDP metadata package for maximum discoverability in 2026.

Rules:
- Description: exactly 150-word Amazon-optimized blurb (HTML allowed, use <b> for key phrases)
- Keywords: 7 keyword phrases (max 50 chars each), ranked by search volume potential
- Price: recommend optimal price point ($0.99-$9.99 range for ebooks)
- Verify BISAC codes are real Amazon categories

Return JSON:
{
  "title": "<finalized title>",
  "subtitle": "<finalized subtitle (max 200 chars)>",
  "description": "<150-word HTML description>",
  "keywords": [<exactly 7 keyword phrases>],
  "bisac_primary": "<BISAC code>",
  "bisac_secondary": "<BISAC code>",
  "price_usd": <number>
}`;

  const result = await chatJSON(prompt, 1000) as MetadataPackage;
  return result;
}

// ── Quality check ─────────────────────────────────────────────────────────────

async function qualityCheck(book: LwBook, chapters: LwChapter[]): Promise<{ passed: boolean; issues: string[] }> {
  const issues: string[] = [];
  const totalWords = chapters.reduce((sum, c) => sum + c.word_count, 0);

  if (totalWords < book.word_count_target * 0.8) {
    issues.push(`Word count ${totalWords} is below 80% of target ${book.word_count_target}`);
  }
  if (!book.description || book.description.length < 100) {
    issues.push('Book description is missing or too short');
  }
  if (!book.bisac_primary) {
    issues.push('Primary BISAC category not set');
  }
  const kw = parseJsonArray(book.keywords);
  if (kw.length < 7) {
    issues.push(`Only ${kw.length} keywords set (need 7)`);
  }
  const failedChapters = chapters.filter(c => c.status === 'failed');
  if (failedChapters.length > 0) {
    issues.push(`${failedChapters.length} chapter(s) failed to generate`);
  }

  return { passed: issues.length === 0, issues };
}

function parseJsonArray(raw: string): string[] {
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

export async function runFullPipeline(bookId: string): Promise<void> {
  const setStage = async (stage: string, progress: number) => {
    await updateBook(bookId, { pipeline_stage: stage, pipeline_progress: progress });
  };
  const setError = async (err: string) => {
    await updateBook(bookId, {
      pipeline_stage: 'failed',
      pipeline_error: err,
      status: 'idea',
    });
  };

  try {
    const book = await queryOne<LwBook>('SELECT * FROM lw_books WHERE id = $1', [bookId]);
    if (!book) throw new Error(`Book ${bookId} not found`);

    await updateBook(bookId, { status: 'blueprinting', pipeline_error: null });

    // ── Stage 1: Blueprint ──────────────────────────────────────────────────
    await setStage('blueprint', 5);
    const blueprint = await generateBlueprint(
      book.genre,
      book.subgenre || book.genre,
      book.word_count_target,
      book.title || undefined
    );

    await updateBook(bookId, {
      title: blueprint.title,
      subtitle: blueprint.subtitle,
      target_audience: blueprint.target_audience,
      bisac_primary: blueprint.bisac_primary,
      bisac_secondary: blueprint.bisac_secondary,
      status: 'generating',
    });

    // Insert chapters
    await execute(`DELETE FROM lw_chapters WHERE book_id = $1`, [bookId]);
    for (const ch of blueprint.chapters) {
      await execute(
        `INSERT INTO lw_chapters (id, book_id, chapter_number, title, outline, status)
         VALUES ($1,$2,$3,$4,$5,'pending')`,
        [crypto.randomUUID(), bookId, ch.number, ch.title, ch.outline]
      );
    }

    // ── Stage 2: Generate chapters ──────────────────────────────────────────
    await setStage('generating_chapters', 10);
    const chapters = await query<LwChapter>(
      'SELECT * FROM lw_chapters WHERE book_id = $1 ORDER BY chapter_number',
      [bookId]
    );

    const summaries: string[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const progress = 10 + Math.round((i / chapters.length) * 55);
      await setStage('generating_chapters', progress);

      await execute(`UPDATE lw_chapters SET status = 'generating' WHERE id = $1`, [ch.id]);
      try {
        const content = await generateChapter(book, ch, summaries);
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        await execute(
          `UPDATE lw_chapters SET content = $1, word_count = $2, status = 'complete' WHERE id = $3`,
          [content, wordCount, ch.id]
        );
        summaries.push(`${ch.title} — ${ch.outline.split('\n')[0]?.trim() || ''}`);
      } catch (err) {
        await execute(`UPDATE lw_chapters SET status = 'failed' WHERE id = $1`, [ch.id]);
        console.error(`[lw] Chapter ${ch.chapter_number} failed:`, err);
      }
    }

    // ── Stage 3: Metadata ───────────────────────────────────────────────────
    await setStage('metadata', 68);
    const freshBook = await queryOne<LwBook>('SELECT * FROM lw_books WHERE id = $1', [bookId]);
    const freshChapters = await query<LwChapter>(
      'SELECT * FROM lw_chapters WHERE book_id = $1 ORDER BY chapter_number',
      [bookId]
    );
    if (!freshBook) throw new Error('Book disappeared during pipeline');

    const meta = await generateMetadataPackage(freshBook, freshChapters);
    const totalWords = freshChapters.reduce((sum, c) => sum + c.word_count, 0);

    await updateBook(bookId, {
      title: meta.title,
      subtitle: meta.subtitle,
      description: meta.description,
      keywords: JSON.stringify(meta.keywords),
      bisac_primary: meta.bisac_primary,
      bisac_secondary: meta.bisac_secondary,
      price_usd: meta.price_usd,
      word_count_actual: totalWords,
    });

    // ── Stage 4: Assemble EPUB ──────────────────────────────────────────────
    await setStage('assembling', 80);
    const bookForEpub = await queryOne<LwBook>('SELECT * FROM lw_books WHERE id = $1', [bookId]);
    const chaptersForEpub = await query<LwChapter>(
      `SELECT * FROM lw_chapters WHERE book_id = $1 AND status = 'complete' ORDER BY chapter_number`,
      [bookId]
    );
    if (!bookForEpub) throw new Error('Book not found for EPUB assembly');

    const epubBuf = buildEpub(
      {
        id: bookId,
        title: bookForEpub.title,
        subtitle: bookForEpub.subtitle,
        author: bookForEpub.author_name,
        description: bookForEpub.description,
        genre: bookForEpub.genre,
        keywords: parseJsonArray(bookForEpub.keywords),
      },
      chaptersForEpub.map(c => ({
        number: c.chapter_number,
        title: c.title,
        content: c.content,
      }))
    );
    const epubBase64 = epubBuf.toString('base64');

    // ── Stage 5: Quality check ──────────────────────────────────────────────
    await setStage('quality_check', 92);
    const finalBook = await queryOne<LwBook>('SELECT * FROM lw_books WHERE id = $1', [bookId]);
    const finalChapters = await query<LwChapter>(
      'SELECT * FROM lw_chapters WHERE book_id = $1 ORDER BY chapter_number',
      [bookId]
    );
    if (!finalBook) throw new Error('Book not found for quality check');

    const qc = await qualityCheck(finalBook, finalChapters);

    await updateBook(bookId, {
      epub_base64: epubBase64,
      pipeline_stage: 'complete',
      pipeline_progress: 100,
      status: qc.passed ? 'epub_ready' : 'review',
      pipeline_error: qc.issues.length > 0 ? qc.issues.join('; ') : null,
    });

    console.log(`[lw] Pipeline complete for "${finalBook.title}" (${bookId}) — QC: ${qc.passed ? 'PASSED' : 'REVIEW'}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[lw] Pipeline failed for ${bookId}:`, msg);
    await setError(msg).catch(() => {});
  }
}

// ── Schedule queue slot ───────────────────────────────────────────────────────

export async function scheduleBook(bookId: string): Promise<{ scheduled_date: string; slot: number }> {
  // Find next available slot (max 3 per day, never on past dates)
  const today = new Date().toISOString().split('T')[0];
  const row = await queryOne<{ scheduled_date: string; slot: number }>(
    `WITH slots AS (
       SELECT d::date AS d, s AS slot
       FROM generate_series(NOW()::date, NOW()::date + INTERVAL '30 days', '1 day') AS d,
            generate_series(1, 3) AS s
     )
     SELECT s.d::text AS scheduled_date, s.slot
     FROM slots s
     WHERE s.d >= $1::date
       AND NOT EXISTS (
         SELECT 1 FROM lw_queue q
         WHERE q.scheduled_date = s.d
           AND q.slot = s.slot
           AND q.status NOT IN ('cancelled','failed')
       )
     ORDER BY s.d, s.slot
     LIMIT 1`,
    [today]
  );

  if (!row) throw new Error('No available KDP queue slots in the next 30 days');

  await execute(
    `INSERT INTO lw_queue (id, book_id, scheduled_date, slot, status)
     VALUES ($1, $2, $3, $4, 'scheduled')`,
    [crypto.randomUUID(), bookId, row.scheduled_date, row.slot]
  );

  await updateBook(bookId, { status: 'queued' });
  return row;
}
