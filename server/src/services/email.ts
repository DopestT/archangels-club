import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'Archangels Club <noreply@archangels.club>';
const BASE_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

// ─── Base HTML template ───────────────────────────────────────────────────────

function buildHtml(opts: {
  eyebrow?: string;
  heading: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
}): string {
  const { eyebrow, heading, lines, ctaLabel, ctaUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#09090B;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:48px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:36px;">
      <span style="font-family:Georgia,serif;font-size:20px;color:#D4AF37;letter-spacing:0.16em;font-weight:normal;">ARCHANGELS</span>
    </div>

    <!-- Card -->
    <div style="background:#0F0F14;border:1px solid rgba(212,175,55,0.18);border-radius:16px;padding:44px 40px;">

      ${eyebrow ? `<p style="font-family:Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#D4AF37;margin:0 0 16px;">${eyebrow}</p>` : ''}

      <h1 style="font-family:Georgia,serif;font-size:28px;color:#FFFFFF;margin:0 0 24px;line-height:1.3;font-weight:normal;">${heading}</h1>

      ${lines.map(l => `<p style="font-family:Helvetica,sans-serif;font-size:15px;color:rgba(255,255,255,0.65);margin:0 0 12px;line-height:1.6;">${l}</p>`).join('')}

      <!-- CTA -->
      <div style="margin-top:32px;">
        <a href="${ctaUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#D4AF37,#B8962E);color:#09090B;font-family:Helvetica,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.04em;">
          ${ctaLabel}
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:28px;">
      <p style="font-family:Helvetica,sans-serif;font-size:11px;color:rgba(255,255,255,0.22);margin:0;">
        Archangels Club &nbsp;·&nbsp;
        <a href="${BASE_URL}/settings/notifications" style="color:rgba(255,255,255,0.3);text-decoration:underline;">Manage notifications</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Send helper ──────────────────────────────────────────────────────────────

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dev] To: ${to} | Subject: ${subject}`);
    return true;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    return true;
  } catch (err) {
    console.error('[email] send failed:', err);
    return false;
  }
}

// ─── Creator templates ────────────────────────────────────────────────────────

export async function sendCreatorWelcome(to: string, name: string) {
  return send(to, "You've been selected", buildHtml({
    eyebrow: 'Welcome to Archangels',
    heading: "You're in. Let's get you earning.",
    lines: [
      `Hey ${name},`,
      "You've been approved as a creator on Archangels Club. Your profile is now live and discoverable.",
      "Creators who post within 24 hours of joining earn significantly more in their first week. Post your first piece of content now and start building momentum.",
    ],
    ctaLabel: 'Upload Now →',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorFirstPostReminder(to: string, name: string) {
  return send(to, 'Start earning today', buildHtml({
    eyebrow: 'First Post Reminder',
    heading: 'Creators who post early earn faster.',
    lines: [
      `${name},`,
      "You haven't posted yet. Creators who upload their first content within 24 hours of joining earn 3× more in their first month.",
      "Upload your first post now. Even one piece of content starts the momentum.",
    ],
    ctaLabel: 'Post Now →',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorFirstSale(to: string, name: string, amount: number) {
  return send(to, 'You made your first sale', buildHtml({
    eyebrow: 'First Sale',
    heading: 'You just made your first sale.',
    lines: [
      `Congratulations, ${name}.`,
      `You earned <strong style="color:#D4AF37;">$${amount.toFixed(2)}</strong> on your first content unlock. This is just the start.`,
      "Post again today while the momentum is high. Creators who follow up within 24 hours of their first sale see a 60% faster growth rate.",
    ],
    ctaLabel: 'Post Again →',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorInactivity(to: string, name: string, daysSincePost: number) {
  return send(to, "Don't lose momentum", buildHtml({
    eyebrow: 'Activity Reminder',
    heading: "Don't lose momentum.",
    lines: [
      `${name},`,
      `It's been ${daysSincePost} days since your last post. Your subscribers are waiting for new content.`,
      "Posting today increases your visibility and keeps your earning streak alive. Even a short clip or photo set is enough.",
    ],
    ctaLabel: 'Upload Now →',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorWeeklySummary(to: string, name: string, stats: {
  earnings: number;
  unlocks: number;
  newSubscribers: number;
  topPost: string;
}) {
  return send(to, 'Your weekly performance', buildHtml({
    eyebrow: 'Weekly Summary',
    heading: "Here's how you did this week.",
    lines: [
      `${name}, here's your performance snapshot:`,
      `<strong style="color:#FFFFFF;">Earnings:</strong> <span style="color:#D4AF37;">$${stats.earnings.toFixed(2)}</span> &nbsp;·&nbsp; <strong style="color:#FFFFFF;">Unlocks:</strong> ${stats.unlocks} &nbsp;·&nbsp; <strong style="color:#FFFFFF;">New Subscribers:</strong> ${stats.newSubscribers}`,
      `<strong style="color:#FFFFFF;">Top Post:</strong> "${stats.topPost}"`,
      "Keep the momentum going. Post new content this week to stay at the top of your subscribers' feeds.",
    ],
    ctaLabel: 'View Dashboard →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendCreatorDropReminder(to: string, name: string, dropName: string, dropTime: string) {
  return send(to, 'Your drop is coming', buildHtml({
    eyebrow: 'Drop Reminder',
    heading: 'Your drop is scheduled soon.',
    lines: [
      `${name},`,
      `<strong style="color:#FFFFFF;">${dropName}</strong> goes live at ${dropTime}.`,
      "Announce it to your subscribers now to build anticipation. Drops that are announced in advance convert up to 4× better.",
    ],
    ctaLabel: 'View Drop →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendCreatorDropLive(to: string, name: string, dropName: string) {
  return send(to, 'Your drop is live', buildHtml({
    eyebrow: 'Drop Alert',
    heading: 'Your drop is live.',
    lines: [
      `${name},`,
      `<strong style="color:#D4AF37;">${dropName}</strong> is now live and available for members to unlock.`,
      "Limited drops typically sell out within hours. Share it with your audience to maximize results.",
    ],
    ctaLabel: 'View Drop →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

// ─── User templates ───────────────────────────────────────────────────────────

export async function sendUserWelcome(to: string, name: string) {
  return send(to, "You're in", buildHtml({
    eyebrow: 'Access Granted',
    heading: "You're in. Exclusive access starts now.",
    lines: [
      `Welcome, ${name}.`,
      "Your access to Archangels Club has been approved. You now have full access to discover, follow, and unlock exclusive content from our creator community.",
      "Explore the platform and find creators worth supporting.",
    ],
    ctaLabel: 'Start Exploring →',
    ctaUrl: `${BASE_URL}/explore`,
  }));
}

export async function sendUserRejected(to: string, name: string) {
  return send(to, 'Update on your access request', buildHtml({
    eyebrow: 'Access Request',
    heading: 'Your request was not approved.',
    lines: [
      `Hi ${name},`,
      'After review, we were unable to approve your access request at this time.',
      'If you believe this was in error or would like to provide additional information, you may submit a new request.',
    ],
    ctaLabel: 'Learn More →',
    ctaUrl: `${BASE_URL}/signup`,
  }));
}

export async function sendUserMoreInfoRequested(to: string, name: string) {
  return send(to, 'Additional information needed', buildHtml({
    eyebrow: 'Access Request',
    heading: 'We need a bit more information.',
    lines: [
      `Hi ${name},`,
      "Our team is reviewing your access request and needs additional information before we can make a decision.",
      "Please reply to this email with any details that support your application.",
    ],
    ctaLabel: 'Submit New Request →',
    ctaUrl: `${BASE_URL}/signup`,
  }));
}

export async function sendCreatorRejected(to: string, name: string) {
  return send(to, 'Update on your creator application', buildHtml({
    eyebrow: 'Creator Application',
    heading: 'Your creator application was not approved.',
    lines: [
      `Hi ${name},`,
      "After review, we were unable to approve your creator application at this time.",
      "You may reapply after 30 days. Ensure your profile is complete and your content plan meets our community standards.",
    ],
    ctaLabel: 'View Requirements →',
    ctaUrl: `${BASE_URL}/apply-creator`,
  }));
}

export async function sendContentApproved(to: string, name: string, contentTitle: string) {
  return send(to, 'Your content is live', buildHtml({
    eyebrow: 'Content Approved',
    heading: 'Your content is now live.',
    lines: [
      `${name},`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> has been approved and is now visible to members.`,
      "Promote it to your subscribers to maximize reach.",
    ],
    ctaLabel: 'View Content →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendContentRejected(to: string, name: string, contentTitle: string) {
  return send(to, 'Content not approved', buildHtml({
    eyebrow: 'Content Review',
    heading: 'Your content was not approved.',
    lines: [
      `${name},`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> did not meet our content guidelines and has not been published.`,
      "Review our content policy and resubmit if appropriate.",
    ],
    ctaLabel: 'View Guidelines →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendContentChangesRequested(to: string, name: string, contentTitle: string) {
  return send(to, 'Changes requested on your content', buildHtml({
    eyebrow: 'Content Review',
    heading: 'Changes requested.',
    lines: [
      `${name},`,
      `Our team has reviewed <strong style="color:#FFFFFF;">${contentTitle}</strong> and is requesting changes before it can be approved.`,
      "Edit your content and resubmit for review.",
    ],
    ctaLabel: 'Edit Content →',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendUserNewContent(to: string, name: string, creatorName: string, contentTitle: string, contentId: string) {
  return send(to, `New content from ${creatorName}`, buildHtml({
    eyebrow: 'New Content',
    heading: `${creatorName} just posted new content.`,
    lines: [
      `${name},`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> is now available.`,
      "Unlock it now before it's gone.",
    ],
    ctaLabel: 'View Content →',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}

export async function sendUserDropAlert(to: string, name: string, contentTitle: string, contentId: string, remaining?: number) {
  const scarcityLine = remaining !== undefined && remaining <= 20
    ? `<strong style="color:#D4AF37;">Only ${remaining} unlocks remaining.</strong> Don't miss it.`
    : "Limited access. Once it's gone, it's gone.";
  return send(to, 'Drop is live', buildHtml({
    eyebrow: 'Limited Drop',
    heading: 'A limited drop just went live.',
    lines: [
      `${name},`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> is now available for a limited time.`,
      scarcityLine,
    ],
    ctaLabel: 'Unlock Now →',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}

export async function sendUserInactivity(to: string, name: string) {
  return send(to, "Don't miss out", buildHtml({
    eyebrow: 'You Have Unread Content',
    heading: "New content is waiting for you.",
    lines: [
      `${name},`,
      "You haven't unlocked anything recently. Creators you follow have been busy.",
      "Explore new content before limited drops sell out.",
    ],
    ctaLabel: 'Explore Now →',
    ctaUrl: `${BASE_URL}/explore`,
  }));
}

export async function sendUserPurchaseConfirmation(to: string, name: string, contentTitle: string, contentId: string) {
  return send(to, 'Access unlocked', buildHtml({
    eyebrow: 'Purchase Confirmed',
    heading: 'Access unlocked.',
    lines: [
      `${name},`,
      `You now have full access to <strong style="color:#FFFFFF;">${contentTitle}</strong>.`,
      "Enjoy your content. More exclusive drops are on the way.",
    ],
    ctaLabel: 'View Content →',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}
