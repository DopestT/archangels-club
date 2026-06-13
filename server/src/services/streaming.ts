import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

export interface StreamToken {
  token: string;
  uid: number;
  channel: string;
  appId: string;
  expiresAt: number;
  provider: 'agora';
}

export interface StreamProviderNone {
  provider: 'none';
  message: string;
}

export type StreamResult = StreamToken | StreamProviderNone;

export function isStreamingConfigured(): boolean {
  return !!(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
}

export function generateStreamToken(
  channel: string,
  uid: number,
  role: 'host' | 'audience'
): StreamResult {
  const appId = process.env.AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !certificate) {
    return { provider: 'none', message: 'Streaming provider not configured.' };
  }

  try {
    const { RtcTokenBuilder, RtcRole } = _require('agora-token');
    const expiresInSeconds = 3600; // 1 hour
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const agoraRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

    const token: string = RtcTokenBuilder.buildTokenWithUid(
      appId,
      certificate,
      channel,
      uid,
      agoraRole,
      expiresAt
    );

    return { token, uid, channel, appId, expiresAt: expiresAt * 1000, provider: 'agora' };
  } catch (err) {
    console.error('[streaming] token generation failed:', err);
    return { provider: 'none', message: 'Token generation failed.' };
  }
}
