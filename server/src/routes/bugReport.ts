import { Router } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = resolve(__dirname, '..', '..', '..', '..', 'docs', 'BUG_REPORT.json');

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/', (_req, res) => {
  if (!existsSync(REPORT_PATH)) {
    return res.json({
      timestamp: null,
      git_sha: 'unknown',
      summary: { total: 0, errors: 0, warnings: 0, all_pass: true },
      checks: [],
      bugs: [],
    });
  }
  try {
    const raw = readFileSync(REPORT_PATH, 'utf8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: 'Failed to read bug report' });
  }
});

export default router;
