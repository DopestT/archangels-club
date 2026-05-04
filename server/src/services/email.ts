import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM ?? 'Archangels Club <access@archangelsclub.com>';
const BASE_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

// ─── Base HTML template ───────────────────────────────────────────────────────

function buildHtml(opts: {
  eyebrow?: string;
  heading: string;
  lines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  receiptRows?: { label: string; value: string; gold?: boolean }[];
}): string {
  const { eyebrow, heading, lines, ctaLabel, ctaUrl, receiptRows } = opts;

  const ctaBlock = ctaLabel && ctaUrl ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:36px;">
                <tr>
                  <td>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="${ctaUrl}"
                      style="height:48px;v-text-anchor:middle;width:240px;"
                      arcsize="5%" stroke="f" fillcolor="#C8A96A">
                      <w:anchorlock/>
                      <center style="color:#000000;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.06em;">${ctaLabel}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${ctaUrl}"
                       style="background:#C8A96A;color:#000000;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;display:inline-block;letter-spacing:0.06em;border-radius:4px;-webkit-text-size-adjust:none;">
                      ${ctaLabel}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>` : '';

  const receiptBlock = receiptRows && receiptRows.length > 0 ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="margin-top:32px;border-top:1px solid rgba(200,169,106,0.15);">
                ${receiptRows.map(row => `
                <tr>
                  <td style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.4);padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                    ${row.label}
                  </td>
                  <td align="right" style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${row.gold ? '#C8A96A' : 'rgba(255,255,255,0.85)'};padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-weight:${row.gold ? '600' : 'normal'};">
                    ${row.value}
                  </td>
                </tr>`).join('')}
              </table>` : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${heading}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    @media only screen and (max-width:620px) {
      .aw-wrap { width:100% !important; }
      .aw-card { padding:32px 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#000000;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#000000;">
  <tr>
    <td align="center" style="padding:52px 20px 40px;">

      <table role="presentation" class="aw-wrap" cellpadding="0" cellspacing="0" border="0"
             width="600" style="width:600px;">

        <!-- Sigil -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#C8A96A;letter-spacing:0.24em;line-height:1;">&#10022;</span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td class="aw-card"
              style="background:#080808;border:1px solid rgba(200,169,106,0.14);padding:48px 52px;">

            ${eyebrow ? `
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#C8A96A;margin:0 0 22px;padding:0;">
              ${eyebrow}
            </p>` : ''}

            <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#FFFFFF;margin:0 0 28px;padding:0;line-height:1.35;font-weight:normal;letter-spacing:-0.01em;">
              ${heading}
            </h1>

            ${lines.map(l => `
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:rgba(255,255,255,0.58);margin:0 0 14px;padding:0;line-height:1.7;">
              ${l}
            </p>`).join('')}

            ${receiptBlock}
            ${ctaBlock}

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="font-family:Helvetica,Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.18);margin:0;padding:0;letter-spacing:0.03em;">
              Archangels Club &nbsp;&middot;&nbsp;
              <a href="${BASE_URL}/settings/notifications"
                 style="color:rgba(255,255,255,0.28);text-decoration:underline;">Manage notifications</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

// ─── Send helper ──────────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

async function send(to: string, subject: string, html: string): Promise<SendResult> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dev] RESEND_API_KEY not set — skipping send. To: ${to} | Subject: ${subject}`);
    return { ok: true, messageId: 'dev-no-key' };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) {
      console.error(`[email] Resend error — to: ${to} | subject: ${subject} | error:`, JSON.stringify(error));
      return { ok: false, error: error.message ?? JSON.stringify(error) };
    }
    console.log(`[email] sent — to: ${to} | subject: ${subject} | messageId: ${data?.id}`);
    return { ok: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email] send threw — to: ${to} | subject: ${subject} | err:`, err);
    return { ok: false, error: message };
  }
}

// ─── Creator templates ────────────────────────────────────────────────────────

export async function sendCreatorWelcome(to: string, name: string) {
  return send(to, 'Your Archangels Club creator account is approved', buildHtml({
    eyebrow: 'Creator Approved',
    heading: 'Your creator account is approved.',
    lines: [
      `${name}.`,
      'Congratulations — your Archangels Club creator account has been approved.',
      'You can now log in, complete your profile, upload content, and start building your audience.',
      'Welcome to Archangels Club.',
    ],
    ctaLabel: 'Go to Creator Studio',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendCreatorFirstPostReminder(to: string, name: string) {
  return send(to, 'Your profile is empty', buildHtml({
    eyebrow: 'Reminder',
    heading: 'No content yet.',
    lines: [
      `${name}.`,
      'Your profile is active but you have not posted. Members cannot subscribe to an empty profile.',
      'Upload your first piece of content to start earning.',
    ],
    ctaLabel: 'Upload Now',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorFirstSale(to: string, name: string, amount: number) {
  return send(to, 'First sale', buildHtml({
    eyebrow: 'Sale',
    heading: 'Your first sale.',
    lines: [
      `${name}.`,
      `Your content earned <strong style="color:#C8A96A;">$${amount.toFixed(2)}</strong>.`,
      'Post again to build on this.',
    ],
    ctaLabel: 'Upload Content',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorInactivity(to: string, name: string, daysSincePost: number) {
  return send(to, `${daysSincePost} days without new content`, buildHtml({
    eyebrow: 'Inactivity',
    heading: `${daysSincePost} days without a post.`,
    lines: [
      `${name}.`,
      'Your subscribers are still active. Inactive profiles lose visibility in member discovery.',
      'Post today to maintain your standing.',
    ],
    ctaLabel: 'Upload Now',
    ctaUrl: `${BASE_URL}/upload`,
  }));
}

export async function sendCreatorWeeklySummary(to: string, name: string, stats: {
  earnings: number;
  unlocks: number;
  newSubscribers: number;
  topPost: string;
}) {
  return send(to, 'Weekly summary', buildHtml({
    eyebrow: 'Weekly Summary',
    heading: 'This week.',
    lines: [
      `${name}.`,
    ],
    receiptRows: [
      { label: 'Earnings', value: `$${stats.earnings.toFixed(2)}`, gold: true },
      { label: 'Unlocks', value: String(stats.unlocks) },
      { label: 'New Subscribers', value: String(stats.newSubscribers) },
      { label: 'Top Post', value: stats.topPost },
    ],
    ctaLabel: 'View Dashboard',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendCreatorDropReminder(to: string, name: string, dropName: string, dropTime: string) {
  return send(to, 'Drop scheduled', buildHtml({
    eyebrow: 'Drop Reminder',
    heading: 'Your drop goes live soon.',
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${dropName}</strong> is scheduled for ${dropTime}.`,
      'Notify your subscribers now to maximize reach at launch.',
    ],
    ctaLabel: 'View Drop',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendCreatorDropLive(to: string, name: string, dropName: string) {
  return send(to, 'Your drop is live', buildHtml({
    eyebrow: 'Drop Live',
    heading: 'Live now.',
    lines: [
      `${name}.`,
      `<strong style="color:#C8A96A;">${dropName}</strong> is now available to members.`,
    ],
    ctaLabel: 'View Drop',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

// ─── User templates ───────────────────────────────────────────────────────────

export async function sendSetPasswordEmail(to: string, name: string, token: string) {
  return send(to, 'Your access has been approved', buildHtml({
    eyebrow: 'Access Granted',
    heading: 'You have been approved.',
    lines: [
      `${name || 'Welcome'}.`,
      'Your access to Archangels Club has been approved. Set your password to activate your account.',
      '<strong style="color:#C8A96A;">This link expires in 24 hours.</strong>',
    ],
    ctaLabel: 'Set Password',
    ctaUrl: `${BASE_URL}/set-password?token=${token}`,
  }));
}

export async function sendForgotPasswordEmail(to: string, token: string) {
  return send(to, 'Reset your Archangels Club password', buildHtml({
    heading: 'Reset your password.',
    lines: [
      'You requested to reset your Archangels Club password.',
      'Click the link below to create a new password.',
      '<strong style="color:#C8A96A;">This link expires in 24 hours.</strong>',
      'If you did not request this, you can ignore this email.',
    ],
    ctaLabel: 'Reset Password',
    ctaUrl: `${BASE_URL}/reset-password?token=${token}`,
  }));
}

export async function sendUserWelcome(to: string, name: string) {
  return send(to, 'Access granted', buildHtml({
    eyebrow: 'Access Granted',
    heading: "You're in.",
    lines: [
      `${name}.`,
      'Your access to Archangels Club is active. Discover and unlock exclusive content from our creator community.',
    ],
    ctaLabel: 'Start Exploring',
    ctaUrl: `${BASE_URL}/explore`,
  }));
}

export async function sendUserRejected(to: string, name: string) {
  return send(to, 'Access request update', buildHtml({
    eyebrow: 'Access Request',
    heading: 'Not approved.',
    lines: [
      `${name}.`,
      'Your access request has been reviewed. At this time, we are unable to grant access.',
      'You may submit a new request if your circumstances have changed.',
    ],
    ctaLabel: 'Submit New Request',
    ctaUrl: `${BASE_URL}/signup`,
  }));
}

export async function sendUserMoreInfoRequested(to: string, name: string) {
  return send(to, 'Additional information required', buildHtml({
    eyebrow: 'Access Request',
    heading: 'More information required.',
    lines: [
      `${name}.`,
      'Your request is under review. Our team requires additional information before a decision can be made.',
      'Reply to this email with any supporting details.',
    ],
  }));
}

export async function sendCreatorRejected(to: string, name: string) {
  return send(to, 'Creator application update', buildHtml({
    eyebrow: 'Creator Application',
    heading: 'Application not approved.',
    lines: [
      `${name}.`,
      'Your creator application has been reviewed. It does not meet our current requirements.',
      'You may reapply after 30 days. Ensure your profile and content plan are complete before resubmitting.',
    ],
    ctaLabel: 'View Requirements',
    ctaUrl: `${BASE_URL}/apply-creator`,
  }));
}

export async function sendContentApproved(to: string, name: string, contentTitle: string) {
  return send(to, 'Content approved', buildHtml({
    eyebrow: 'Content Approved',
    heading: 'Your content is live.',
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> has been approved and is now visible to members.`,
    ],
    ctaLabel: 'View Content',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendContentRejected(to: string, name: string, contentTitle: string) {
  return send(to, 'Content not approved', buildHtml({
    eyebrow: 'Content Review',
    heading: 'Not approved.',
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> does not meet our content guidelines and has not been published.`,
      'Review our content policy before resubmitting.',
    ],
    ctaLabel: 'View Guidelines',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendContentChangesRequested(to: string, name: string, contentTitle: string) {
  return send(to, 'Changes requested', buildHtml({
    eyebrow: 'Content Review',
    heading: 'Changes required.',
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> requires changes before it can be approved.`,
      'Edit and resubmit for review.',
    ],
    ctaLabel: 'Edit Content',
    ctaUrl: `${BASE_URL}/creator`,
  }));
}

export async function sendUserNewContent(to: string, name: string, creatorName: string, contentTitle: string, contentId: string) {
  return send(to, `New drop from ${creatorName}`, buildHtml({
    eyebrow: 'New Drop',
    heading: `${creatorName} just posted.`,
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> is now available.`,
    ],
    ctaLabel: 'View Now',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}

export async function sendUserDropAlert(to: string, name: string, contentTitle: string, contentId: string, remaining?: number) {
  const scarcityLine = remaining !== undefined && remaining <= 20
    ? `<strong style="color:#C8A96A;">${remaining} unlocks remaining.</strong>`
    : 'Limited availability.';
  return send(to, 'Limited drop live', buildHtml({
    eyebrow: 'Limited Drop',
    heading: 'Live now.',
    lines: [
      `${name}.`,
      `<strong style="color:#FFFFFF;">${contentTitle}</strong> is available for a limited time.`,
      scarcityLine,
    ],
    ctaLabel: 'Unlock Now',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}

export async function sendUserInactivity(to: string, name: string) {
  return send(to, 'Content waiting', buildHtml({
    eyebrow: 'Unread Content',
    heading: 'You have content waiting.',
    lines: [
      `${name}.`,
      'Creators you follow have been active. New content and limited drops are available.',
    ],
    ctaLabel: 'Explore Now',
    ctaUrl: `${BASE_URL}/explore`,
  }));
}

export async function sendUserPurchaseConfirmation(to: string, name: string, contentTitle: string, contentId: string) {
  return send(to, 'Access unlocked', buildHtml({
    eyebrow: 'Transaction Confirmed',
    heading: 'Access unlocked.',
    lines: [
      `${name}.`,
    ],
    receiptRows: [
      { label: 'Content', value: contentTitle },
      { label: 'Status', value: 'Unlocked', gold: true },
    ],
    ctaLabel: 'View Content',
    ctaUrl: `${BASE_URL}/content/${contentId}`,
  }));
}
