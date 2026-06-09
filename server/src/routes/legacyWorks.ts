import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { query, queryOne, execute } from '../db/schema.js';
import {
  researchNiche,
  generateBlueprint,
  runFullPipeline,
  scheduleBook,
} from '../services/legacyWorksGenerator.js';

const router = Router();

// All Legacy Works routes require admin auth
router.use(requireAuth, requireAdmin);

// ── GET /api/legacy-works/books ───────────────────────────────────────────────

router.get('/books', async (_req, res) => {
  try {
    const books = await query<{
      id: string; title: string; subtitle: string; genre: string;
      status: string; pipeline_stage: string; pipeline_progress: number;
      pipeline_error: string | null; word_count_actual: number; word_count_target: number;
      price_usd: string; niche_score: string | null; created_at: string; updated_at: string;
      chapter_count: number; completed_chapters: number;
    }>(
      `SELECT b.*,
         (SELECT COUNT(*) FROM lw_chapters WHERE book_id = b.id)::int AS chapter_count,
         (SELECT COUNT(*) FROM lw_chapters WHERE book_id = b.id AND status = 'complete')::int AS completed_chapters
       FROM lw_books b
       ORDER BY b.updated_at DESC`
    );
    res.json({ books });
  } catch (err) {
    console.error('[lw/books] GET error:', err);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// ── POST /api/legacy-works/books ─────────────────────────────────────────────

router.post('/books', async (req, res) => {
  const { genre, subgenre, title, word_count_target, author_name, series_name, series_number } = req.body;

  if (!genre) {
    res.status(400).json({ error: 'genre is required' });
    return;
  }

  try {
    const id = crypto.randomUUID();
    await execute(
      `INSERT INTO lw_books
         (id, genre, subgenre, title, word_count_target, author_name, series_name, series_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        genre,
        subgenre ?? '',
        title ?? '',
        word_count_target ?? 25000,
        author_name ?? 'Legacy Works Publishing',
        series_name ?? '',
        series_number ?? null,
      ]
    );
    const book = await queryOne<object>('SELECT * FROM lw_books WHERE id = $1', [id]);
    res.status(201).json({ book });
  } catch (err) {
    console.error('[lw/books] POST error:', err);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// ── GET /api/legacy-works/books/:id ──────────────────────────────────────────

router.get('/books/:id', async (req, res) => {
  try {
    const [book, chapters] = await Promise.all([
      queryOne<object>('SELECT * FROM lw_books WHERE id = $1', [req.params.id]),
      query<object>(
        `SELECT id, chapter_number, title, outline, word_count, status, created_at
         FROM lw_chapters WHERE book_id = $1 ORDER BY chapter_number`,
        [req.params.id]
      ),
    ]);
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
    res.json({ book, chapters });
  } catch (err) {
    console.error('[lw/books/:id] error:', err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// ── GET /api/legacy-works/books/:id/chapter/:num ──────────────────────────────

router.get('/books/:id/chapter/:num', async (req, res) => {
  try {
    const chapter = await queryOne<object>(
      'SELECT * FROM lw_chapters WHERE book_id = $1 AND chapter_number = $2',
      [req.params.id, parseInt(req.params.num)]
    );
    if (!chapter) { res.status(404).json({ error: 'Chapter not found' }); return; }
    res.json({ chapter });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chapter' });
  }
});

// ── PATCH /api/legacy-works/books/:id ────────────────────────────────────────

router.patch('/books/:id', async (req, res) => {
  const allowed = ['title', 'subtitle', 'genre', 'subgenre', 'author_name',
    'word_count_target', 'price_usd', 'description', 'keywords',
    'bisac_primary', 'bisac_secondary', 'series_name', 'series_number', 'cover_url'];
  const updates: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'No valid fields to update' });
    return;
  }
  try {
    const keys = Object.keys(updates);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await execute(
      `UPDATE lw_books SET ${sets}, updated_at = NOW() WHERE id = $1`,
      [req.params.id, ...Object.values(updates)]
    );
    const book = await queryOne<object>('SELECT * FROM lw_books WHERE id = $1', [req.params.id]);
    res.json({ book });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// ── DELETE /api/legacy-works/books/:id ───────────────────────────────────────

router.delete('/books/:id', async (req, res) => {
  try {
    await execute('DELETE FROM lw_books WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// ── POST /api/legacy-works/books/:id/pipeline/run ────────────────────────────

router.post('/books/:id/pipeline/run', async (req, res) => {
  try {
    const book = await queryOne<{ id: string; pipeline_stage: string }>(
      'SELECT id, pipeline_stage FROM lw_books WHERE id = $1',
      [req.params.id]
    );
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }

    if (['blueprint', 'generating_chapters', 'assembling', 'metadata', 'quality_check'].includes(book.pipeline_stage)) {
      res.status(409).json({ error: 'Pipeline is already running' });
      return;
    }

    // Reset state for re-runs
    await execute(
      `UPDATE lw_books
       SET pipeline_stage = 'blueprint', pipeline_progress = 0, pipeline_error = NULL,
           status = 'blueprinting', updated_at = NOW()
       WHERE id = $1`,
      [book.id]
    );

    // Fire-and-forget — pipeline updates DB as it progresses
    runFullPipeline(book.id).catch(err => {
      console.error(`[lw] Unhandled pipeline error for ${book.id}:`, err);
    });

    res.json({ ok: true, message: 'Pipeline started' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start pipeline' });
  }
});

// ── GET /api/legacy-works/books/:id/pipeline/status ──────────────────────────

router.get('/books/:id/pipeline/status', async (req, res) => {
  try {
    const row = await queryOne<{
      status: string; pipeline_stage: string; pipeline_progress: number;
      pipeline_error: string | null; word_count_actual: number; updated_at: string;
      chapter_count: number; completed_chapters: number;
    }>(
      `SELECT b.status, b.pipeline_stage, b.pipeline_progress, b.pipeline_error,
              b.word_count_actual, b.updated_at,
              (SELECT COUNT(*) FROM lw_chapters WHERE book_id = b.id)::int AS chapter_count,
              (SELECT COUNT(*) FROM lw_chapters WHERE book_id = b.id AND status = 'complete')::int AS completed_chapters
       FROM lw_books b WHERE b.id = $1`,
      [req.params.id]
    );
    if (!row) { res.status(404).json({ error: 'Book not found' }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ── GET /api/legacy-works/books/:id/export/epub ──────────────────────────────

router.get('/books/:id/export/epub', async (req, res) => {
  try {
    const book = await queryOne<{ title: string; epub_base64: string | null }>(
      'SELECT title, epub_base64 FROM lw_books WHERE id = $1',
      [req.params.id]
    );
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
    if (!book.epub_base64) { res.status(422).json({ error: 'EPUB not ready — run pipeline first' }); return; }

    const buf = Buffer.from(book.epub_base64, 'base64');
    const filename = `${book.title.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.epub`;
    res.setHeader('Content-Type', 'application/epub+zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buf.length.toString());
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export EPUB' });
  }
});

// ── GET /api/legacy-works/books/:id/export/metadata ─────────────────────────

router.get('/books/:id/export/metadata', async (req, res) => {
  try {
    const book = await queryOne<{
      title: string; subtitle: string; author_name: string;
      description: string; keywords: string; bisac_primary: string;
      bisac_secondary: string; price_usd: string; genre: string;
      ai_disclosure: boolean; word_count_actual: number;
    }>(
      `SELECT title, subtitle, author_name, description, keywords,
              bisac_primary, bisac_secondary, price_usd, genre,
              ai_disclosure, word_count_actual
       FROM lw_books WHERE id = $1`,
      [req.params.id]
    );
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }

    let keywords: string[] = [];
    try { keywords = JSON.parse(book.keywords); } catch {}

    res.json({
      title: book.title,
      subtitle: book.subtitle,
      author: book.author_name,
      description: book.description,
      keywords,
      bisac_primary: book.bisac_primary,
      bisac_secondary: book.bisac_secondary,
      price_usd: parseFloat(book.price_usd),
      genre: book.genre,
      ai_disclosure: book.ai_disclosure,
      word_count: book.word_count_actual,
      kdp_checklist: [
        { item: 'Title entered', done: !!book.title },
        { item: 'Subtitle entered', done: !!book.subtitle },
        { item: 'Description written', done: book.description.length >= 100 },
        { item: '7 keywords set', done: keywords.length >= 7 },
        { item: 'Primary BISAC set', done: !!book.bisac_primary },
        { item: 'Secondary BISAC set', done: !!book.bisac_secondary },
        { item: 'Price set', done: parseFloat(book.price_usd) > 0 },
        { item: 'AI disclosure required', done: book.ai_disclosure },
        { item: 'EPUB ready for upload', done: false },
      ],
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to export metadata' });
  }
});

// ── POST /api/legacy-works/books/:id/queue ───────────────────────────────────

router.post('/books/:id/queue', async (req, res) => {
  try {
    const book = await queryOne<{ status: string }>(
      'SELECT status FROM lw_books WHERE id = $1',
      [req.params.id]
    );
    if (!book) { res.status(404).json({ error: 'Book not found' }); return; }
    if (!['epub_ready', 'review'].includes(book.status)) {
      res.status(422).json({ error: 'Book must be in epub_ready or review status to queue' });
      return;
    }

    const slot = await scheduleBook(req.params.id);
    res.json({ ok: true, ...slot });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to schedule book';
    res.status(422).json({ error: msg });
  }
});

// ── GET /api/legacy-works/queue ──────────────────────────────────────────────

router.get('/queue', async (_req, res) => {
  try {
    const rows = await query<object>(
      `SELECT q.*, b.title, b.genre, b.status AS book_status, b.price_usd
       FROM lw_queue q
       JOIN lw_books b ON b.id = q.book_id
       ORDER BY q.scheduled_date, q.slot`
    );
    res.json({ queue: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// ── POST /api/legacy-works/niche-research ────────────────────────────────────

router.post('/niche-research', async (req, res) => {
  const { genre, topic } = req.body;
  if (!genre || !topic) {
    res.status(400).json({ error: 'genre and topic are required' });
    return;
  }
  try {
    const result = await researchNiche(genre, topic);
    res.json({ research: result });
  } catch (err) {
    console.error('[lw/niche-research] error:', err);
    res.status(500).json({ error: 'Failed to run niche research' });
  }
});

// ── GET /api/legacy-works/niche-research ─────────────────────────────────────

router.get('/niche-research', async (_req, res) => {
  try {
    const rows = await query<object>(
      `SELECT id, query, genre, profitability_score, competition_score, demand_score,
              recommended_price, keyword_suggestions, title_hooks, notes, created_at
       FROM lw_niche_research ORDER BY created_at DESC LIMIT 50`
    );
    res.json({ research: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch niche research' });
  }
});

// ── POST /api/legacy-works/blueprint ─────────────────────────────────────────

router.post('/blueprint', async (req, res) => {
  const { genre, topic, word_count_target, existing_title } = req.body;
  if (!genre || !topic) {
    res.status(400).json({ error: 'genre and topic are required' });
    return;
  }
  try {
    const blueprint = await generateBlueprint(genre, topic, word_count_target ?? 25000, existing_title);
    res.json({ blueprint });
  } catch (err) {
    console.error('[lw/blueprint] error:', err);
    res.status(500).json({ error: 'Failed to generate blueprint' });
  }
});

// ── GET /api/legacy-works/stats ──────────────────────────────────────────────

router.get('/stats', async (_req, res) => {
  try {
    const stats = await queryOne<{
      total_books: number; epub_ready: number; published: number;
      queued: number; generating: number; total_words: number;
    }>(
      `SELECT
         COUNT(*)::int AS total_books,
         COUNT(*) FILTER (WHERE status = 'epub_ready')::int AS epub_ready,
         COUNT(*) FILTER (WHERE status = 'published')::int AS published,
         COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
         COUNT(*) FILTER (WHERE status = 'generating')::int AS generating,
         COALESCE(SUM(word_count_actual),0)::int AS total_words
       FROM lw_books`
    );
    const queueStats = await queryOne<{ scheduled: number; next_open: string | null }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
         (
           SELECT q2.scheduled_date::text
           FROM (
             SELECT d::date AS scheduled_date
             FROM generate_series(NOW()::date, NOW()::date + INTERVAL '7 days', '1 day') AS d
             WHERE (
               SELECT COUNT(*) FROM lw_queue
               WHERE scheduled_date = d::date AND status NOT IN ('cancelled','failed')
             ) < 3
             ORDER BY d LIMIT 1
           ) q2
         ) AS next_open`
    );
    res.json({ ...stats, ...queueStats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
