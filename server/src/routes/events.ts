import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { logEvent } from '../services/events.js';

const router = Router();

const ALLOWED_EVENTS = new Set([
  'view_creator',
  'view_content',
  'search',
  'unlock_content',
  'subscribe_creator',
  'unsubscribe_creator',
  'save_content',
  'unsave_content',
  'send_message',
  'send_tip',
  'submit_custom_request',
  'login',
  'signup',
  'apply_creator',
  'publish_content',
  'page_view',
  // Legacy names — kept for backwards compat
  'content_view',
  'content_unlock',
  'creator_subscribe',
  'creator_profile_view',
  'explore_search',
  'signal_sent',
  'content_share',
  'vault_view',
  'custom_request_sent',
]);

// POST /api/events
// Fire-and-forget behavioral event ingestion. Auth optional — anonymous events are valid.
// Send `idempotency_key` (a client-generated UUID) to make retries safe.
router.post('/', optionalAuth, async (req, res) => {
  const { event_type, entity_type, entity_id, session_id, metadata, idempotency_key } = req.body;

  if (!event_type || typeof event_type !== 'string' || !ALLOWED_EVENTS.has(event_type)) {
    res.status(400).json({ error: 'Invalid or missing event_type.' });
    return;
  }

  await logEvent({
    userId: req.auth?.userId ?? null,
    sessionId: session_id ?? null,
    eventType: event_type,
    entityType: entity_type ?? null,
    entityId: entity_id ?? null,
    metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
    idempotencyKey: typeof idempotency_key === 'string' ? idempotency_key : null,
  });

  res.json({ ok: true });
});

export default router;
