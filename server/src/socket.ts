import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

let _io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return _io;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  const ALLOWED_ORIGINS = [
    'https://archangelsclub.com',
    'https://www.archangelsclub.com',
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:5173']
      : []),
  ];

  _io = new SocketIOServer(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware — reject unauthenticated sockets
  _io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token as string | undefined ||
      (socket.handshake.headers.authorization ?? '').replace('Bearer ', '');

    if (!token) return next(new Error('Authentication required'));

    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error('Server misconfiguration'));

    try {
      const payload = jwt.verify(token, secret) as { userId: string; role?: string };
      socket.data.userId = payload.userId;
      socket.data.role = payload.role ?? 'fan';
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  _io.on('connection', socket => {
    socket.on('join-room', (roomId: string) => {
      if (typeof roomId === 'string' && roomId.length < 200) {
        socket.join(`room:${roomId}`);
      }
    });

    socket.on('leave-room', (roomId: string) => {
      if (typeof roomId === 'string') {
        socket.leave(`room:${roomId}`);
      }
    });
  });

  return _io;
}
