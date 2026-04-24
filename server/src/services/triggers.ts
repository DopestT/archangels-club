/**
 * Event-driven trigger system.
 * Call these functions from routes after significant events occur.
 * Each trigger decides which channels fire based on user preferences + timing.
 */

import { queryOne } from '../db/schema.js';
import { createInAppNotification, getPreferences } from './notifications.js';
import {
  sendCreatorWelcome, sendCreatorFirstPostReminder, sendCreatorFirstSale,
  sendCreatorInactivity, sendCreatorWeeklySummary, sendCreatorDropReminder,
  sendCreatorDropLive, sendUserWelcome, sendUserNewContent, sendUserDropAlert,
  sendUserInactivity, sendUserPurchaseConfirmation,
} from './email.js';
import {
  smsCreatorFirstSale, smsCreatorDropLive,
  smsUserDropAlert, smsUserScarcityAlert,
} from './sms.js';

const BASE_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

// ─── Time-of-day check ────────────────────────────────────────────────────────

function inSendWindow(windowType: 'morning' | 'afternoon' | 'evening'): boolean {
  const h = new Date().getHours();
  if (windowType === 'morning')   return h >= 9  && h < 11;
  if (windowType === 'afternoon') return h >= 13 && h < 16;
  if (windowType === 'evening')   return h >= 19 && h < 22;
  return true;
}

// ─── User lookup ──────────────────────────────────────────────────────────────

async function getUserById(userId: string): Promise<{ email: string; display_name: string; phone?: string } | null> {
  return queryOne<{ email: string; display_name: string; phone?: string }>(
    'SELECT email, display_name, phone FROM users WHERE id = $1',
    [userId]
  );
}

// ─── Creator triggers ─────────────────────────────────────────────────────────

export async function triggerAccountApproved(userId: string, role: 'fan' | 'creator') {
  const user = await getUserById(userId);
  if (!user) return;
  const prefs = await getPreferences(userId);

  if (role === 'creator') {
    await createInAppNotification({
      userId,
      type: 'creator_welcome',
      title: "You've been selected",
      message: "Your creator account is approved. Post your first content now to start earning.",
      actionLabel: 'Start Training',
      actionUrl: `${BASE_URL}/creator/onboarding`,
    });
    if (prefs.email_enabled) await sendCreatorWelcome(user.email, user.display_name);
  } else {
    await createInAppNotification({
      userId,
      type: 'user_welcome',
      title: "You're in",
      message: "Your access to Archangels Club has been approved. Start exploring exclusive content.",
      actionLabel: 'Explore',
      actionUrl: `${BASE_URL}/explore`,
    });
    if (prefs.email_enabled) await sendUserWelcome(user.email, user.display_name);
  }
}

export async function triggerCreatorFirstPost(creatorId: string) {
  await createInAppNotification({
    userId: creatorId,
    type: 'creator_first_post',
    title: "First post submitted",
    message: "Your content is under review. You'll be notified once it's approved and live.",
    actionLabel: 'View Dashboard',
    actionUrl: `${BASE_URL}/creator`,
  });
}

export async function triggerCreatorFirstSale(creatorId: string, amount: number) {
  const user = await getUserById(creatorId);
  if (!user) return;
  const prefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_first_sale',
    title: `First sale — $${amount.toFixed(2)} earned`,
    message: "You just made your first sale. Post again today to keep the momentum going.",
    actionLabel: 'Post Again',
    actionUrl: `${BASE_URL}/upload`,
  });

  if (prefs.email_enabled) await sendCreatorFirstSale(user.email, user.display_name, amount);
  if (prefs.sms_enabled && prefs.sms_major_events && user.phone) {
    await smsCreatorFirstSale(user.phone);
  }
}

export async function triggerCreatorFirstPostReminder(creatorId: string) {
  const user = await getUserById(creatorId);
  if (!user) return;
  const prefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_first_post_reminder',
    title: "Post your first content",
    message: "Creators who post early earn faster. Upload your first piece of content now.",
    actionLabel: 'Upload Now',
    actionUrl: `${BASE_URL}/upload`,
  });

  if (prefs.email_enabled) await sendCreatorFirstPostReminder(user.email, user.display_name);
}

export async function triggerCreatorInactivity(creatorId: string, daysSincePost: number) {
  const user = await getUserById(creatorId);
  if (!user) return;
  const prefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_inactivity',
    title: `${daysSincePost} days without a post`,
    message: "Posting today increases visibility and keeps your earning streak alive.",
    actionLabel: 'Upload Now',
    actionUrl: `${BASE_URL}/upload`,
  });

  if (prefs.email_enabled) await sendCreatorInactivity(user.email, user.display_name, daysSincePost);
}

export async function triggerCreatorWeeklySummary(creatorId: string, stats: {
  earnings: number; unlocks: number; newSubscribers: number; topPost: string;
}) {
  const user = await getUserById(creatorId);
  if (!user) return;
  const prefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_weekly_summary',
    title: `Weekly summary — $${stats.earnings.toFixed(2)} earned`,
    message: `${stats.unlocks} unlocks · ${stats.newSubscribers} new subscribers · Top: "${stats.topPost}"`,
    actionLabel: 'View Dashboard',
    actionUrl: `${BASE_URL}/creator`,
  });

  if (prefs.email_enabled && prefs.email_weekly_summary) {
    await sendCreatorWeeklySummary(user.email, user.display_name, stats);
  }
}

export async function triggerDropScheduled(creatorId: string, dropName: string, dropTime: string) {
  const user = await getUserById(creatorId);
  if (!user) return;
  const prefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_drop_reminder',
    title: `Drop scheduled: ${dropName}`,
    message: `Your drop goes live at ${dropTime}. Announce it now to build anticipation.`,
    actionLabel: 'View Drop',
    actionUrl: `${BASE_URL}/creator`,
  });

  if (prefs.email_enabled && prefs.email_drops) {
    await sendCreatorDropReminder(user.email, user.display_name, dropName, dropTime);
  }
}

export async function triggerDropLive(opts: {
  creatorId: string;
  dropName: string;
  contentId: string;
  followerIds: string[];
}) {
  const { creatorId, dropName, contentId, followerIds } = opts;
  const creator = await getUserById(creatorId);
  if (!creator) return;
  const creatorPrefs = await getPreferences(creatorId);

  await createInAppNotification({
    userId: creatorId,
    type: 'creator_drop_live',
    title: `Your drop is live: ${dropName}`,
    message: "Members can now unlock. Share to maximize results.",
    actionLabel: 'View Drop',
    actionUrl: `${BASE_URL}/creator`,
  });
  if (creatorPrefs.email_enabled && creatorPrefs.email_drops) {
    await sendCreatorDropLive(creator.email, creator.display_name, dropName);
  }
  if (creatorPrefs.sms_enabled && creatorPrefs.sms_drops && creator.phone) {
    await smsCreatorDropLive(creator.phone, dropName);
  }

  const shouldSendNow = inSendWindow('evening');
  for (const userId of followerIds) {
    const user = await getUserById(userId);
    if (!user) continue;
    const prefs = await getPreferences(userId);

    await createInAppNotification({
      userId,
      type: 'user_drop_alert',
      title: `Drop live: ${dropName}`,
      message: `Limited access is now available. Unlock before it's gone.`,
      actionLabel: 'Unlock Now',
      actionUrl: `${BASE_URL}/content/${contentId}`,
    });

    if (shouldSendNow && prefs.email_enabled && prefs.email_drops) {
      await sendUserDropAlert(user.email, user.display_name, dropName, contentId);
    }
    if (prefs.sms_enabled && prefs.sms_drops && user.phone) {
      await smsUserDropAlert(user.phone, dropName, contentId);
    }
  }
}

// ─── User triggers ────────────────────────────────────────────────────────────

export async function triggerNewContent(opts: {
  creatorId: string;
  creatorName: string;
  contentId: string;
  contentTitle: string;
  followerIds: string[];
}) {
  const { creatorName, contentId, contentTitle, followerIds } = opts;

  for (const userId of followerIds) {
    const user = await getUserById(userId);
    if (!user) continue;
    const prefs = await getPreferences(userId);

    await createInAppNotification({
      userId,
      type: 'user_new_content',
      title: `New from ${creatorName}`,
      message: `"${contentTitle}" is now available.`,
      actionLabel: 'View',
      actionUrl: `${BASE_URL}/content/${contentId}`,
    });

    if (prefs.email_enabled && prefs.email_new_content) {
      await sendUserNewContent(user.email, user.display_name, creatorName, contentTitle, contentId);
    }
  }
}

export async function triggerUserInactivity(userId: string) {
  const user = await getUserById(userId);
  if (!user) return;
  const prefs = await getPreferences(userId);

  await createInAppNotification({
    userId,
    type: 'user_inactivity',
    title: "New content is waiting",
    message: "You haven't explored recently. Check what's new from creators you follow.",
    actionLabel: 'Explore',
    actionUrl: `${BASE_URL}/explore`,
  });

  if (prefs.email_enabled) await sendUserInactivity(user.email, user.display_name);
}

export async function triggerPurchaseConfirmation(userId: string, contentTitle: string, contentId: string) {
  const user = await getUserById(userId);
  if (!user) return;
  const prefs = await getPreferences(userId);

  await createInAppNotification({
    userId,
    type: 'user_purchase',
    title: "Access unlocked",
    message: `You now have full access to "${contentTitle}".`,
    actionLabel: 'View Content',
    actionUrl: `${BASE_URL}/content/${contentId}`,
  });

  if (prefs.email_enabled && prefs.email_purchases) {
    await sendUserPurchaseConfirmation(user.email, user.display_name, contentTitle, contentId);
  }
}

export async function triggerScarcityAlert(opts: {
  contentTitle: string;
  contentId: string;
  remaining: number;
  interestedUserIds: string[];
}) {
  const { contentTitle, contentId, remaining, interestedUserIds } = opts;

  for (const userId of interestedUserIds) {
    const user = await getUserById(userId);
    if (!user) continue;
    const prefs = await getPreferences(userId);

    await createInAppNotification({
      userId,
      type: 'user_scarcity_alert',
      title: `Only ${remaining} unlocks left`,
      message: `"${contentTitle}" is almost gone. Unlock now before it sells out.`,
      actionLabel: 'Unlock Now',
      actionUrl: `${BASE_URL}/content/${contentId}`,
    });

    if (prefs.sms_enabled && prefs.sms_drops && user.phone) {
      await smsUserScarcityAlert(user.phone, remaining, contentId);
    }
  }
}
