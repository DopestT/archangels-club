import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GiftAnimationHandle, GiftEvent } from '../components/live/GiftAnimationManager';

const SERVER_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export function useGiftSocket(
  roomId: string | undefined,
  giftAnimRef: React.RefObject<GiftAnimationHandle | null>,
  enabled: boolean,
) {
  const socketRef = useRef<Socket | null>(null);

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
      socket.emit('join-room', roomId);
    });

    socket.on('gift:sent', (event: GiftEvent) => {
      giftAnimRef.current?.emit(event);
    });

    return () => {
      socket.emit('leave-room', roomId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, roomId]); // eslint-disable-line react-hooks/exhaustive-deps
}
