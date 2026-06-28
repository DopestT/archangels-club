import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GiftAnimationHandle, GiftEvent } from '../components/live/GiftAnimationManager';

const SERVER_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Connects to the live-gift socket and forwards `gift:sent` events to the
 * animation manager. Returns a ref whose `.current` is true while the socket is
 * connected — callers use it to avoid double-animating gifts they also detect
 * through leaderboard polling (the socket owns gift visuals when it's live).
 */
export function useGiftSocket(
  roomId: string | undefined,
  giftAnimRef: React.RefObject<GiftAnimationHandle | null>,
  enabled: boolean,
): React.MutableRefObject<boolean> {
  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const raw = localStorage.getItem('arc_auth');
    let token: string | null = null;
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      token = parsed?.token ?? null;
    } catch {
      return;
    }
    if (!token) return;

    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      connectedRef.current = true;
      socket.emit('join-room', roomId);
    });

    socket.on('disconnect', () => { connectedRef.current = false; });

    socket.on('gift:sent', (event: GiftEvent) => {
      giftAnimRef.current?.emit(event);
    });

    return () => {
      connectedRef.current = false;
      socket.emit('leave-room', roomId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  return connectedRef;
}
