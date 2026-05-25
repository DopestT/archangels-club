import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth, requireCreator, requireApproved } from '../middleware/auth.js';
import { uploadRateLimit, concurrentUploadGuard } from '../middleware/uploadGuard.js';
import { execute } from '../db/schema.js';
import { logAuditEvent } from '../services/audit.js';

const router = Router();

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/aac',
]);

// Known extension → expected MIME(s). Used to catch renamed/spoofed files.
const EXT_TO_MIMES: Record<string, string[]> = {
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'],
  '.png': ['image/png'], '.gif': ['image/gif'], '.webp': ['image/webp'],
  '.mp4': ['video/mp4'], '.mov': ['video/quicktime'],
  '.webm': ['video/webm'], '.avi': ['video/x-msvideo'],
  '.mp3': ['audio/mpeg'], '.m4a': ['audio/mp4'],
  '.wav': ['audio/wav'], '.ogg': ['audio/ogg'], '.aac': ['audio/aac'],
};

const UPLOAD_TEMP = path.join(os.tmpdir(), 'archangels-uploads');
fs.mkdirSync(UPLOAD_TEMP, { recursive: true });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  api_key: process.env.CLOUDINARY_API_KEY ?? '',
  api_secret: process.env.CLOUDINARY_API_SECRET ?? '',
  secure: true,
});

const upload = multer({
  dest: UPLOAD_TEMP,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB ceiling; Cloudinary enforces per-type limits
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      cb(new Error('UNSUPPORTED_TYPE'));
    } else {
      cb(null, true);
    }
  },
});

function cldResourceType(mime: string): 'image' | 'video' {
  return mime.startsWith('image/') ? 'image' : 'video'; // audio uses 'video' in Cloudinary
}

function cldFolder(creatorId: string, mime: string): string {
  if (mime.startsWith('image/')) return `archangels/creators/${creatorId}/images`;
  if (mime.startsWith('audio/')) return `archangels/creators/${creatorId}/audio`;
  return `archangels/creators/${creatorId}/videos`;
}

function safeDel(filePath?: string): void {
  if (filePath) fs.unlink(filePath, () => {});
}

// POST /api/media/upload
router.post(
  '/upload',
  requireAuth,
  requireApproved,
  requireCreator,
  uploadRateLimit,
  concurrentUploadGuard,
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const creatorId = req.auth!.userId;
    const file = req.file;
    const mediaAssetId = crypto.randomUUID();

    if (!file) {
      console.log(`[media/upload] rejected no-file | creator=${creatorId}`);
      logAuditEvent({ eventType: 'media_upload_failed', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'failure', metadata: { reason: 'no_file' } }).catch(() => {});
      res.status(400).json({ success: false, error: 'No media file was attached.' });
      return;
    }

    if (file.size === 0) {
      safeDel(file.path);
      console.log(`[media/upload] rejected empty-file | creator=${creatorId}`);
      logAuditEvent({ eventType: 'media_upload_failed', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'failure', metadata: { reason: 'empty_file', filename: file.originalname } }).catch(() => {});
      res.status(400).json({ success: false, error: 'The file appears to be empty.' });
      return;
    }

    // Extension / MIME mismatch — catches renamed files (e.g. malware.exe renamed to image.jpg)
    const ext = path.extname(file.originalname).toLowerCase();
    const expectedMimes = EXT_TO_MIMES[ext];
    if (expectedMimes && !expectedMimes.includes(file.mimetype)) {
      safeDel(file.path);
      console.log(`[media/upload] rejected ext-mime-mismatch | creator=${creatorId} ext=${ext} mime=${file.mimetype}`);
      logAuditEvent({ eventType: 'media_upload_failed', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'failure', metadata: { reason: 'ext_mime_mismatch', ext, mime: file.mimetype } }).catch(() => {});
      res.status(400).json({ success: false, error: 'This file type is not supported yet.' });
      return;
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      safeDel(file.path);
      console.error(`[media/upload] storage not configured | creator=${creatorId}`);
      logAuditEvent({ eventType: 'media_upload_failed', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'failure', metadata: { reason: 'storage_not_configured' } }).catch(() => {});
      res.status(503).json({ success: false, error: 'Media storage is temporarily unavailable. Your draft is still safe.' });
      return;
    }

    const resType = cldResourceType(file.mimetype);
    const folder = cldFolder(creatorId, file.mimetype);

    // Create media_asset record in 'uploading' state before the Cloudinary call
    await execute(
      `INSERT INTO media_assets (id, creator_user_id, status) VALUES ($1, $2, 'uploading')`,
      [mediaAssetId, creatorId]
    ).catch(() => {}); // non-fatal if table not yet migrated

    console.log(`[media/upload] attempt | creator=${creatorId} mime=${file.mimetype} size=${file.size} folder=${folder} asset=${mediaAssetId}`);
    logAuditEvent({ eventType: 'media_upload_started', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'pending', metadata: { mime: file.mimetype, bytes: file.size, filename: file.originalname } }).catch(() => {});

    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: resType,
        folder,
        use_filename: false,
        unique_filename: true,
      });

      safeDel(file.path);
      console.log(`[media/upload] success | creator=${creatorId} public_id=${result.public_id} bytes=${result.bytes} asset=${mediaAssetId}`);

      const thumbnailUrl = resType === 'video'
        ? cloudinary.url(result.public_id, {
            resource_type: 'video',
            transformation: [{ width: 640, height: 360, crop: 'fill', format: 'jpg', quality: 'auto' }],
            secure: true,
          })
        : null;

      // Update media_asset record to 'ready' with full metadata
      await execute(
        `UPDATE media_assets
           SET status = 'ready',
               public_id = $1, secure_url = $2, resource_type = $3, format = $4,
               duration = $5, bytes = $6, width = $7, height = $8, thumbnail_url = $9,
               updated_at = NOW()
         WHERE id = $10`,
        [
          result.public_id, result.secure_url, result.resource_type, result.format,
          result.duration ?? null, result.bytes ?? null, result.width ?? null, result.height ?? null,
          thumbnailUrl,
          mediaAssetId,
        ]
      ).catch(() => {}); // non-fatal

      logAuditEvent({ eventType: 'media_upload_ready', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'success', metadata: { public_id: result.public_id, bytes: result.bytes, resource_type: result.resource_type } }).catch(() => {});

      res.json({
        success: true,
        media_asset_id: mediaAssetId,
        asset: {
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
          format: result.format,
          bytes: result.bytes,
          duration: result.duration ?? null,
          width: result.width ?? null,
          height: result.height ?? null,
          thumbnail_url: thumbnailUrl,
          preview_url: result.secure_url,
        },
      });
    } catch (err) {
      safeDel(file.path);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[media/upload] cloudinary failure | creator=${creatorId} asset=${mediaAssetId} reason=${msg}`);

      await execute(
        `UPDATE media_assets SET status = 'failed', failure_reason = $1, updated_at = NOW() WHERE id = $2`,
        [msg.slice(0, 500), mediaAssetId]
      ).catch(() => {}); // non-fatal

      logAuditEvent({ eventType: 'media_upload_failed', actorUserId: creatorId, entityType: 'media_asset', entityId: mediaAssetId, status: 'failure', metadata: { reason: msg.slice(0, 500) } }).catch(() => {});

      res.status(503).json({
        success: false,
        error: 'Media storage is temporarily unavailable. Your draft is still safe.',
        media_asset_id: mediaAssetId,
      });
    }
  }
);

// Multer error handler — catches LIMIT_FILE_SIZE and fileFilter rejections
router.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: 'This file is too large to upload.' });
    } else {
      res.status(400).json({ success: false, error: 'File upload failed. Please try again.' });
    }
    return;
  }
  if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
    res.status(400).json({ success: false, error: 'This file type is not supported yet.' });
    return;
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[media/upload] unexpected error | ${msg}`);
  res.status(500).json({ success: false, error: 'Upload failed. Please try again.' });
});

export default router;
