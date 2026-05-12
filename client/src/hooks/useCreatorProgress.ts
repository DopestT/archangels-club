import { useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreatorLevel = 'new' | 'early' | 'active' | 'established';

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  completed: boolean;
  actionLabel: string;
  actionTo: string;
}

export interface NextAction {
  headline: string;
  subline: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface CreatorProgressState {
  level: CreatorLevel;

  // Atomic flags
  payoutSetup: boolean;
  avatarSet: boolean;
  hasUploads: boolean;
  hasUnlock: boolean;
  hasSubscriber: boolean;
  hasCustomRequest: boolean;
  hasEarnings: boolean;

  // Totals
  totalEarnings: number;
  subscriberCount: number;
  contentUnlocks: number;

  // Checklist
  checklistItems: ChecklistItem[];
  checklistCompletePct: number;
  checklistAllComplete: boolean;

  // Next recommended action — null for active/established creators
  nextAction: NextAction | null;
}

// ─── Input types (matching what CreatorDashboard already fetches) ─────────────

interface DashStats {
  total_earnings: number;
  subscriber_count: number;
  content_unlocks: number;
  tips_total: number;
}

interface DashTransaction {
  ref_type: string;
}

interface DashRequest {
  status: string;
}

// ─── Level thresholds ─────────────────────────────────────────────────────────

function deriveLevel(
  earnings: number,
  subscribers: number,
  unlocks: number,
  hasUploads: boolean,
): CreatorLevel {
  if (earnings >= 500 || subscribers >= 15) return 'established';
  if (earnings >= 100 || (subscribers >= 3 && unlocks >= 5)) return 'active';
  if (earnings > 0 || unlocks > 0 || subscribers > 0 || hasUploads) return 'early';
  return 'new';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCreatorProgress(
  stats: DashStats | null,
  transactions: DashTransaction[],
  requests: DashRequest[],
  stripeOnboarded: boolean,
  avatarUrl: string | null | undefined,
  // NOTE for Claude A: add `content_count` and `has_cover` to GET /api/creators/my/stats
  // Until then, contentCount stays null and the checklist degrades gracefully.
  contentCount: number | null | undefined,
): CreatorProgressState {
  return useMemo(() => {
    const earnings    = stats?.total_earnings   ?? 0;
    const subscribers = stats?.subscriber_count ?? 0;
    const unlocks     = stats?.content_unlocks  ?? 0;

    const payoutSetup     = stripeOnboarded;
    const avatarSet       = Boolean(avatarUrl);
    // Use content_count if available; fall back to proxy signals
    const hasUploads      = contentCount != null
      ? contentCount > 0
      : transactions.length > 0 || unlocks > 0;
    const hasUnlock       = unlocks > 0;
    const hasSubscriber   = subscribers > 0;
    const hasEarnings     = earnings > 0;
    const hasCustomRequest = requests.some(
      r => r.status === 'accepted' || r.status === 'completed',
    );

    const level = deriveLevel(earnings, subscribers, unlocks, hasUploads);

    // ─── Checklist ────────────────────────────────────────────────────────────

    const checklistItems: ChecklistItem[] = [
      {
        key: 'payout_setup',
        label: 'Enable payouts',
        hint: 'Unlock the ability to receive earnings. Takes 2 minutes via Stripe.',
        completed: payoutSetup,
        actionLabel: 'Enable Payouts',
        actionTo: '/creator',
      },
      {
        key: 'avatar_set',
        label: 'Add a profile photo',
        hint: 'Creators with a profile photo stand out and attract more members.',
        completed: avatarSet,
        actionLabel: 'Edit Profile',
        actionTo: '/settings',
      },
      {
        key: 'first_upload',
        label: 'Publish your first drop',
        hint: 'Upload a photo or video, set a price, and submit for review.',
        completed: hasUploads,
        actionLabel: 'Create a Drop',
        actionTo: '/upload',
      },
      {
        key: 'first_unlock',
        label: 'Earn your first unlock',
        hint: 'A member paid to access your drop. That\'s real validation.',
        completed: hasUnlock,
        actionLabel: 'View Profile',
        actionTo: '/creator',
      },
      {
        key: 'first_subscriber',
        label: 'Get your first subscriber',
        hint: 'Subscribers are your most reliable income — a recurring monthly commitment.',
        completed: hasSubscriber,
        actionLabel: 'View Profile',
        actionTo: '/creator',
      },
    ];

    const completedCount       = checklistItems.filter(i => i.completed).length;
    const checklistCompletePct = Math.round((completedCount / checklistItems.length) * 100);
    const checklistAllComplete = completedCount === checklistItems.length;

    // ─── Next Action ─────────────────────────────────────────────────────────

    let nextAction: NextAction | null = null;

    if (!payoutSetup) {
      nextAction = {
        headline: 'Unlock your earnings.',
        subline: 'Your first sale could happen today. Connect a bank account to make sure it reaches you.',
        ctaLabel: 'Enable Payouts',
        ctaTo: '/creator',
      };
    } else if (!hasUploads) {
      nextAction = {
        headline: 'Your studio awaits its first drop.',
        subline: "Upload your first locked drop. Every creator's first $100 starts with one.",
        ctaLabel: 'Publish Your First Drop',
        ctaTo: '/upload',
      };
    } else if (!hasUnlock) {
      nextAction = {
        headline: 'Your drop is live. Share it.',
        subline: 'Share your profile link. Creators who promote within 48 hours of upload see measurably more unlocks.',
        ctaLabel: 'View Your Profile',
        ctaTo: '/creator',
      };
    } else if (!hasSubscriber && hasEarnings) {
      nextAction = {
        headline: 'Convert buyers into subscribers.',
        subline: 'Members who unlock once convert to subscribers at a high rate. Make sure your subscription price invites commitment.',
        ctaLabel: 'Review Subscription',
        ctaTo: '/creator',
      };
    } else if (hasEarnings && earnings < 100) {
      const pct = Math.round((earnings / 100) * 100);
      nextAction = {
        headline: `${pct}% to your first $100.`,
        subline: 'One more post typically closes this milestone for new creators.',
        ctaLabel: 'Upload Another Post',
        ctaTo: '/upload',
      };
    }
    // Active and established creators receive null — no hand-holding needed.

    return {
      level,
      payoutSetup,
      avatarSet,
      hasUploads,
      hasUnlock,
      hasSubscriber,
      hasCustomRequest,
      hasEarnings,
      totalEarnings: earnings,
      subscriberCount: subscribers,
      contentUnlocks: unlocks,
      checklistItems,
      checklistCompletePct,
      checklistAllComplete,
      nextAction,
    };
  }, [stats, transactions, requests, stripeOnboarded, avatarUrl, contentCount]);
}
