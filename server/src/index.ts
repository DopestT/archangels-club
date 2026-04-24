import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import creatorRoutes from './routes/creators.js';
import contentRoutes from './routes/content.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import keyRoutes from './routes/keys.js';
import videoRoutes from './routes/video.js';
import notificationRoutes from './routes/notifications.js';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({
  origin: ['http://localhost:3000', process.env.CLIENT_URL ?? ''],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', platform: 'Archangels Club API' });
});

app.listen(PORT, () => {
  console.log(`\n  ✦ Archangels Club API running on http://localhost:${PORT}`);
  console.log(`  ✦ Platform fee: 20%`);
  console.log(`  ✦ Health: http://localhost:${PORT}/api/health\n`);
});
