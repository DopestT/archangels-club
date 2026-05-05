const BASE_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';

async function sendSms(to: string, body: string): Promise<boolean> {
  const FROM = process.env.TWILIO_PHONE_NUMBER ?? '';
  if (!process.env.TWILIO_ACCOUNT_SID || !FROM) {
    console.log(`[sms:dev] To: ${to} | Body: ${body}`);
    return true;
  }
  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN ?? '',
    );
    await client.messages.create({ from: FROM, to, body });
    return true;
  } catch (err) {
    console.error('[sms] send failed:', err);
    return false;
  }
}

// ─── Creator SMS ──────────────────────────────────────────────────────────────

export async function smsCreatorFirstSale(phone: string) {
  return sendSms(phone,
    `You just made your first sale on Archangels Club. Post again to keep momentum. ${BASE_URL}/upload`
  );
}

export async function smsCreatorDropLive(phone: string, dropName: string) {
  return sendSms(phone,
    `Your drop "${dropName}" is live. Limited unlocks available now. ${BASE_URL}/creator`
  );
}

// ─── User SMS ─────────────────────────────────────────────────────────────────

export async function smsUserDropAlert(phone: string, contentTitle: string, contentId: string) {
  return sendSms(phone,
    `Drop is live: "${contentTitle}" — limited access. Don't miss it. ${BASE_URL}/content/${contentId}`
  );
}

export async function smsUserScarcityAlert(phone: string, remaining: number, contentId: string) {
  return sendSms(phone,
    `Only ${remaining} unlock${remaining === 1 ? '' : 's'} left on a limited drop. ${BASE_URL}/content/${contentId}`
  );
}
