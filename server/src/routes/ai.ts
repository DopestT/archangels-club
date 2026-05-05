import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// POST /api/ai/sales-message
router.post('/sales-message', async (req, res) => {
  const { userId, creatorId, contentId, contentTitle, price, lastPurchaseAt } = req.body;

  if (!userId || !creatorId || !contentId || !contentTitle || price === undefined) {
    res.status(400).json({ error: 'userId, creatorId, contentId, contentTitle, and price are required.' });
    return;
  }

  if (lastPurchaseAt) {
    const msSinceLastPurchase = Date.now() - new Date(lastPurchaseAt).getTime();
    if (msSinceLastPurchase < THREE_DAYS_MS) {
      res.json({ skipped: true, reason: 'User purchased recently.' });
      return;
    }
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a short, enticing sales message under 25 words for this exclusive content: "${contentTitle}" priced at $${price}. Be direct and compelling.`,
        },
      ],
      max_tokens: 60,
    });

    const message = completion.choices[0]?.message?.content?.trim() ?? '';
    res.json({ message });
  } catch (err) {
    console.error('[ai/sales-message] OpenAI error:', err);
    return res.status(500).json({
      error: "Failed to generate sales message",
      detail: err instanceof Error ? err.message : String(err)
    });
  }
});

export default router;
