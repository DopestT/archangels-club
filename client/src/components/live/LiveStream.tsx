import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Loader2, Video, VideoOff, Mic, MicOff } from 'lucide-react';

export interface StreamConfig {
  provider: 'agora' | 'none';
  token?: string;
  uid?: number;
  channel?: string;
  appId?: string;
  expiresAt?: number;
  message?: string;
}

interface Props {
  config: StreamConfig;
  role: 'host' | 'audience';
  isLive: boolean;
  onPublishing?: (publishing: boolean) => void;
}

export default function LiveStream({ config, role, isLive, onPublishing }: Props) {
  const localVideoRef  = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const clientRef      = useRef<any>(null);
  const localTracksRef = useRef<any[]>([]);

  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    if (!isLive || config.provider === 'none') return;

    const { appId, token, uid, channel } = config;
    if (!appId || !token || uid == null || !channel) return;

    // These are guaranteed non-null by the guard above
    const safeAppId   = appId   as string;
    const safeToken   = token   as string;
    const safeChannel = channel as string;
    const safeUid     = uid     as number;

    let destroyed = false;

    async function init() {
      setStatus('connecting');
      setStatusMsg('Connecting…');
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        AgoraRTC.setLogLevel(4); // suppress debug logs

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        clientRef.current = client;

        await client.setClientRole(role === 'host' ? 'host' : 'audience');
        await client.join(safeAppId, safeChannel, safeToken, safeUid);

        if (destroyed) { await client.leave(); return; }

        if (role === 'host') {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
          localTracksRef.current = [audioTrack, videoTrack];

          if (localVideoRef.current) {
            videoTrack.play(localVideoRef.current);
          }
          await client.publish([audioTrack, videoTrack]);
          onPublishing?.(true);
        } else {
          // Subscribe to remote tracks
          client.on('user-published', async (remoteUser: any, mediaType: string) => {
            await client.subscribe(remoteUser, mediaType as 'video' | 'audio');
            if (mediaType === 'video' && remoteVideoRef.current) {
              remoteUser.videoTrack?.play(remoteVideoRef.current);
            }
            if (mediaType === 'audio') {
              remoteUser.audioTrack?.play();
            }
          });
          client.on('user-unpublished', (remoteUser: any, mediaType: string) => {
            if (mediaType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.innerHTML = '';
            }
          });
        }

        if (!destroyed) {
          setStatus('connected');
          setStatusMsg('');
        }
      } catch (err: any) {
        if (!destroyed) {
          setStatus('error');
          setStatusMsg(err?.message ?? 'Connection failed.');
          onPublishing?.(false);
        }
      }
    }

    init();

    return () => {
      destroyed = true;
      (async () => {
        for (const track of localTracksRef.current) {
          track.stop();
          track.close();
        }
        localTracksRef.current = [];
        if (clientRef.current) {
          try { await clientRef.current.leave(); } catch { /* ignore */ }
          clientRef.current = null;
        }
        onPublishing?.(false);
      })();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, config.provider, config.appId, config.token, config.uid, config.channel]);

  async function toggleVideo() {
    const track = localTracksRef.current.find(t => t.trackMediaType === 'video');
    if (!track) return;
    const next = !videoEnabled;
    await (next ? track.setEnabled(true) : track.setEnabled(false));
    setVideoEnabled(next);
  }

  async function toggleAudio() {
    const track = localTracksRef.current.find(t => t.trackMediaType === 'audio');
    if (!track) return;
    const next = !audioEnabled;
    await (next ? track.setEnabled(true) : track.setEnabled(false));
    setAudioEnabled(next);
  }

  // Provider not configured
  if (config.provider === 'none') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 p-8 text-center">
        <WifiOff size={32} className="text-zinc-600" />
        <p className="text-sm font-medium text-zinc-400">Streaming provider not configured.</p>
        <p className="text-xs text-zinc-600 max-w-xs">
          {config.message ?? 'Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the server to enable live video.'}
        </p>
      </div>
    );
  }

  if (!isLive) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-500 bg-zinc-900/50 rounded-xl border border-zinc-800 p-8">
        <Wifi size={32} className="text-zinc-600" />
        <p className="text-sm text-zinc-500">Waiting for stream to start…</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden">
      {/* Video containers */}
      {role === 'host' ? (
        <div ref={localVideoRef} className="w-full h-full" />
      ) : (
        <div ref={remoteVideoRef} className="w-full h-full" />
      )}

      {/* Status overlay */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={32} className="text-yellow-400 animate-spin" />
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
          <WifiOff size={28} className="text-red-400" />
          <p className="text-sm text-red-400">{statusMsg}</p>
        </div>
      )}

      {/* Host controls */}
      {role === 'host' && status === 'connected' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-full border transition-colors ${videoEnabled ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700' : 'bg-red-700 border-red-600 text-white'}`}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
          </button>
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-full border transition-colors ${audioEnabled ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700' : 'bg-red-700 border-red-600 text-white'}`}
            title={audioEnabled ? 'Mute mic' : 'Unmute mic'}
          >
            {audioEnabled ? <Mic size={16} /> : <MicOff size={16} />}
          </button>
        </div>
      )}

      {/* LIVE indicator */}
      {status === 'connected' && (
        <div className="absolute top-3 left-3">
          <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        </div>
      )}
    </div>
  );
}
