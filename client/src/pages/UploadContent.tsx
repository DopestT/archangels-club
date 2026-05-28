import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Image, Video, Music, FileText, ArrowLeft, Check, AlertCircle, Clock, Sparkles, X, Save, ChevronDown, RefreshCw } from 'lucide-react';
import { timeAgo } from '../lib/utils';
import type { ContentType, PricingConfig, VideoProcessingConfig } from '../types';
import ImageEditor from '../components/editor/ImageEditor';
import VideoProcessor from '../components/editor/VideoProcessor';
import PricingPanel from '../components/pricing/PricingPanel';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/api';

const CONTENT_TYPES: { id: ContentType; icon: React.ReactNode; label: string }[] = [
  { id: 'image', icon: <Image className="w-5 h-5" />, label: 'Image' },
  { id: 'video', icon: <Video className="w-5 h-5" />, label: 'Video' },
  { id: 'audio', icon: <Music className="w-5 h-5" />, label: 'Audio' },
  { id: 'text', icon: <FileText className="w-5 h-5" />, label: 'Text' },
];

const DEFAULT_PRICING: PricingConfig = {
  accessType: 'locked',
  price: 19.99,
  maxUnlocks: null,
  availableUntil: null,
  subscriberDiscountPct: 0,
  bundleEnabled: false,
  bundleName: '',
  bundlePrice: null,
};

interface ServerAsset {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  thumbnail_url: string | null;
  blurred_preview_url: string | null;
}

type UploadStatus = 'idle' | 'creating_draft' | 'uploading' | 'retrying' | 'saving' | 'submitted';

const RETRY_DELAYS = [1000, 2000, 4000];
const MAX_ATTEMPTS = 4;

function isRetryableError(msg: string): boolean {
  return msg !== 'SESSION_EXPIRED'
    && msg !== 'CREATOR_NOT_APPROVED'
    && !msg.includes('Too many')
    && !msg.includes('(413)');
}

function uploadViaServer(
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<ServerAsset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      let data: any;
      try { data = JSON.parse(xhr.responseText); } catch {
        console.error('[upload] unparseable response:', xhr.status, xhr.responseText.slice(0, 300));
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }
      if (xhr.status === 401) { reject(new Error('SESSION_EXPIRED')); return; }
      if (xhr.status === 403) { reject(new Error(data?.error ?? 'CREATOR_NOT_APPROVED')); return; }
      if (xhr.status === 429) { reject(new Error(data?.error ?? 'Too many uploads. Please wait a moment.')); return; }
      if (xhr.status === 413) { reject(new Error('File too large (413)')); return; }
      if (!data?.success) {
        console.error('[upload] server rejected:', xhr.status, data);
        reject(new Error(data?.error ?? `Upload failed (${xhr.status})`));
        return;
      }
      console.log('[upload] success | public_id:', data.asset.public_id, 'bytes:', data.asset.bytes);
      resolve(data.asset as ServerAsset);
    });
    xhr.addEventListener('error', () => {
      console.error('[upload] network error');
      reject(new Error('Network error during upload.'));
    });
    xhr.open('POST', `${API_BASE}/api/media/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(form);
  });
}

async function uploadViaServerWithRetry(
  file: File,
  token: string,
  onProgress: (pct: number) => void,
  onRetry: (attempt: number) => void,
): Promise<ServerAsset> {
  let lastError: Error = new Error('Unknown upload error');
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      onRetry(attempt);
      await new Promise<void>(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
    }
    try {
      return await uploadViaServer(file, token, onProgress);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!isRetryableError(msg)) throw err;
      lastError = err instanceof Error ? err : new Error(msg);
      console.warn(`[upload] attempt ${attempt + 1} failed, ${attempt < MAX_ATTEMPTS - 1 ? 'will retry' : 'giving up'}:`, msg);
    }
  }
  throw lastError;
}

export default function UploadContent() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentType, setContentType] = useState<ContentType>('image');
  const [file, setFile] = useState<File | null>(null);
  const [enhancedFile, setEnhancedFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [videoConfig, setVideoConfig] = useState<VideoProcessingConfig | null>(null);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(DEFAULT_PRICING);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [submittedTitle, setSubmittedTitle] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [draftNotice, setDraftNotice] = useState<{
    title: string;
    description: string;
    contentType: ContentType;
    pricingConfig: PricingConfig;
    savedAt: string;
    draftId?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeFile = enhancedFile ?? file;
  const canEnhance = file !== null && (contentType === 'image' || contentType === 'video');
  const busy = status === 'creating_draft' || status === 'uploading' || status === 'retrying' || status === 'saving';

  // Restore saved draft on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('arc_upload_draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        title: string; description: string;
        contentType: ContentType; pricingConfig: PricingConfig; savedAt: string;
        draftId?: string;
      };
      if (draft.title || draft.description) setDraftNotice(draft);
    } catch {
      localStorage.removeItem('arc_upload_draft');
    }
  }, []);

  function persistDraft(fields: {
    title: string; description: string; contentType: ContentType;
    pricingConfig: PricingConfig; draftId?: string;
  }) {
    try {
      localStorage.setItem('arc_upload_draft', JSON.stringify({
        ...fields, savedAt: new Date().toISOString(),
      }));
    } catch {}
  }

  function saveDraft() {
    persistDraft({ title, description, contentType, pricingConfig, draftId: draftId ?? undefined });
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  function restoreDraft() {
    if (!draftNotice) return;
    setTitle(draftNotice.title);
    setDescription(draftNotice.description);
    setContentType(draftNotice.contentType);
    setPricingConfig(draftNotice.pricingConfig);
    if (draftNotice.draftId) setDraftId(draftNotice.draftId);
    setDraftNotice(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setEnhancedFile(null);
    setPreviewDataUrl(null);
    setVideoConfig(null);
    setImageDataUrl(null);
    if (f && contentType === 'image') {
      const reader = new FileReader();
      reader.onload = (ev) => setImageDataUrl((ev.target?.result as string) ?? null);
      reader.readAsDataURL(f);
    }
  }

  function handleImageSave(editedFile: File, previewUrl: string) {
    setEnhancedFile(editedFile);
    setPreviewDataUrl(previewUrl);
    setShowEditor(false);
  }

  function handleVideoSave(config: VideoProcessingConfig) {
    setVideoConfig(config);
    setShowEditor(false);
  }

  async function handleSave() {
    if (!title.trim() || !token || busy) return;
    setUploadError('');
    setShowErrorDetails(false);
    setUploadProgress(0);
    setRetryCount(0);

    try {
      // 1. Draft-first: create DB record before any media transfer
      let currentDraftId = draftId;
      if (!currentDraftId) {
        setStatus('creating_draft');
        console.log('[upload] creating draft record');
        const draftRes = await fetch(`${API_BASE}/api/content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            content_type: contentType,
            access_type: pricingConfig.accessType,
            price: pricingConfig.price ?? 0,
            status: 'draft',
          }),
        });
        if (draftRes.status === 401) { logout(); navigate('/login?next=/upload'); return; }
        const draftData = await draftRes.json();
        if (!draftRes.ok) {
          console.error('[upload] draft create failed:', draftRes.status, draftData);
          setUploadError(draftData.error ?? 'Failed to prepare upload. Please try again.');
          setStatus('idle');
          return;
        }
        currentDraftId = draftData.id as string;
        setDraftId(currentDraftId);
        persistDraft({ title, description, contentType, pricingConfig, draftId: currentDraftId });
        console.log('[upload] draft created | id:', currentDraftId);
      }

      // 2. Upload media with automatic retry
      let mediaUrl: string | null = null;
      let previewUrl: string | null = previewDataUrl ?? null;

      if (activeFile) {
        setStatus('uploading');
        console.log('[upload] starting | file:', activeFile.name, 'size:', activeFile.size, 'draftId:', currentDraftId);

        let asset: ServerAsset;
        try {
          asset = await uploadViaServerWithRetry(
            activeFile,
            token,
            (pct) => { setStatus('uploading'); setUploadProgress(pct); },
            (attempt) => {
              setRetryCount(attempt);
              setStatus('retrying');
              setUploadProgress(0);
              console.log(`[upload] retry attempt ${attempt}/${MAX_ATTEMPTS - 1} | draftId:`, currentDraftId);
            },
          );
        } catch (uploadErr) {
          const msg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          if (msg === 'SESSION_EXPIRED') { logout(); navigate('/login?next=/upload'); return; }
          throw uploadErr;
        }

        mediaUrl = asset.secure_url;
        if (!previewUrl) previewUrl = asset.blurred_preview_url ?? asset.thumbnail_url ?? asset.secure_url;
      }

      // 3. PATCH draft with final metadata and media URLs
      setStatus('saving');
      console.log('[upload] saving | draftId:', currentDraftId, 'hasMedia:', !!mediaUrl);
      const patchBody: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        access_type: pricingConfig.accessType,
        price: pricingConfig.price ?? 0,
      };
      if (mediaUrl) patchBody.media_url = mediaUrl;
      if (previewUrl) patchBody.preview_url = previewUrl;

      const patchRes = await fetch(`${API_BASE}/api/content/${currentDraftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patchBody),
      });
      if (patchRes.status === 401) { logout(); navigate('/login?next=/upload'); return; }
      const patchData = await patchRes.json();
      if (!patchRes.ok) {
        console.error('[upload] patch failed:', patchRes.status, patchData);
        setUploadError(patchData.error ?? 'Failed to save. Your draft is protected — please retry.');
        setStatus('idle');
        return;
      }

      // 4. Submit for review
      console.log('[upload] submitting | draftId:', currentDraftId);
      const submitRes = await fetch(`${API_BASE}/api/content/${currentDraftId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (submitRes.status === 401) { logout(); navigate('/login?next=/upload'); return; }
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        console.error('[upload] submit failed:', submitRes.status, submitData);
        setUploadError(submitData.error ?? 'Failed to submit. Your draft is protected — please retry.');
        setStatus('idle');
        return;
      }

      console.log('[upload] submitted | id:', currentDraftId, 'status:', submitData.status);
      setSubmittedTitle(title.trim());
      localStorage.removeItem('arc_upload_draft');
      setDraftId(null);
      setStatus('submitted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach the server.';
      console.error('[upload] unhandled error:', err);
      setUploadError(msg);
      setStatus('idle');
    }
  }

  function resetUpload() {
    setFile(null);
    setEnhancedFile(null);
    setPreviewDataUrl(null);
    setVideoConfig(null);
    setImageDataUrl(null);
    setStatus('idle');
    setUploadProgress(0);
    setRetryCount(0);
    setTitle('');
    setDescription('');
    setPricingConfig(DEFAULT_PRICING);
    setSubmittedTitle('');
    setDraftId(null);
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-arc-success/10 border border-arc-success/30 flex items-center justify-center mx-auto mb-8">
            <Check className="w-9 h-9 text-arc-success" />
          </div>
          <span className="section-eyebrow mb-4 block">Submitted</span>
          <h1 className="font-serif text-3xl text-white">Drop submitted for review.</h1>
          <p className="text-arc-secondary leading-relaxed mb-8">
            <strong className="text-white">{submittedTitle}</strong> is in the review queue. It goes live once approved — usually within 24 hours.
          </p>
          <div className="flex flex-col gap-3">
            <button onClick={resetUpload} className="btn-gold w-full">
              <Upload className="w-4 h-4" />
              Upload Another Drop
            </button>
            <Link to="/creator" className="btn-outline w-full">Back to Creator Studio</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Full-screen editors */}
      {showEditor && file && contentType === 'image' && (
        <ImageEditor
          file={enhancedFile ?? file}
          onSave={handleImageSave}
          onCancel={() => setShowEditor(false)}
        />
      )}
      {showEditor && file && contentType === 'video' && (
        <VideoProcessor
          file={file}
          onSave={handleVideoSave}
          onCancel={() => setShowEditor(false)}
        />
      )}

      <div className="min-h-screen bg-bg-primary py-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">

          <Link
            to="/creator"
            className="inline-flex items-center gap-2 text-sm text-arc-secondary hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Creator Studio
          </Link>

          <div className="mb-8">
            <p className="section-eyebrow mb-2">Creator Studio</p>
            <h1 className="font-serif text-3xl xl:text-4xl text-white">Create a Drop</h1>
            <p className="text-arc-secondary text-sm mt-1">Upload your content. Set your price. Go live.</p>
          </div>

          <div
            className="flex flex-wrap items-center gap-4 sm:gap-6 px-5 py-3 rounded-xl mb-8 text-xs text-arc-muted"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <span className="flex items-center gap-1.5"><span className="text-gold">✓</span> Reviewed before publishing</span>
            <span className="flex items-center gap-1.5"><span className="text-gold">✓</span> Usually within 24h</span>
            <span className="flex items-center gap-1.5"><span className="text-gold">✓</span> Private by Design</span>
          </div>

          {/* Draft restore notice */}
          {draftNotice && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/4 border border-white/10 mb-8">
              <Clock className="w-4 h-4 text-arc-secondary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white">
                  {draftNotice.draftId ? 'In-progress upload recovered' : 'Saved draft found'}
                </p>
                <p className="text-xs text-arc-muted truncate mt-0.5">
                  {draftNotice.title ? `"${draftNotice.title}"` : 'Untitled'} · saved {timeAgo(draftNotice.savedAt)}
                </p>
              </div>
              <button
                onClick={restoreDraft}
                className="text-xs text-gold hover:text-gold px-3 py-1 rounded-lg border border-gold/30 hover:bg-gold/8 transition-all flex-shrink-0"
              >
                Restore
              </button>
              <button
                onClick={() => { setDraftNotice(null); localStorage.removeItem('arc_upload_draft'); }}
                className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/8 transition-all flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-6">

            {/* Content type */}
            <div className="card-surface p-6 rounded-xl">
              <h3 className="font-serif text-lg text-white mb-4">Content Type</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CONTENT_TYPES.map(({ id, icon, label }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setContentType(id);
                      setFile(null);
                      setEnhancedFile(null);
                      setPreviewDataUrl(null);
                      setVideoConfig(null);
                      setImageDataUrl(null);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 ${
                      contentType === id
                        ? 'bg-gold-muted border-gold text-gold shadow-gold-sm'
                        : 'border-white/10 text-arc-secondary hover:border-gold/30 hover:text-white'
                    }`}
                  >
                    {icon}
                    <span className="text-xs font-sans">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="card-surface p-6 rounded-xl">
              <h3 className="font-serif text-lg text-white mb-4">Content Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give your content a compelling title"
                    className="input-dark"
                    maxLength={120}
                  />
                  <p className="text-xs text-arc-muted mt-1 text-right">{title.length}/120</p>
                </div>
                <div>
                  <label className="block text-xs text-arc-secondary mb-1.5">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what members will receive. Tease it, don't spoil it."
                    className="input-dark min-h-24 resize-y"
                    maxLength={500}
                  />
                  <p className="text-xs text-arc-muted mt-1 text-right">{description.length}/500</p>
                </div>
              </div>
            </div>

            {/* File upload */}
            <div className="card-surface p-6 rounded-xl">
              <h3 className="font-serif text-lg text-white mb-4">File</h3>

              {!activeFile ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-white/10 hover:border-gold/40 rounded-xl p-10 text-center cursor-pointer transition-all duration-200 hover:bg-gold-muted/20"
                >
                  <Upload className="w-8 h-8 text-arc-muted mx-auto mb-3" />
                  <p className="text-sm text-arc-secondary">Click to upload or drag & drop</p>
                  <p className="text-xs text-arc-muted mt-1">
                    Max 2 GB ·{' '}
                    {contentType === 'image'
                      ? 'JPG, PNG, GIF, WebP'
                      : contentType === 'video'
                      ? 'MP4, MOV, WebM'
                      : contentType === 'audio'
                      ? 'MP3, M4A, WAV, OGG, AAC'
                      : 'PDF, TXT, MD'}
                  </p>
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden">
                  {/* Preview */}
                  {contentType === 'image' && (previewDataUrl ?? imageDataUrl) && (
                    <div className="w-full max-h-64 overflow-hidden bg-black">
                      <img src={(previewDataUrl ?? imageDataUrl)!} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                  )}
                  {contentType === 'video' && videoConfig?.thumbnail && (
                    <div className="w-full max-h-48 overflow-hidden bg-black">
                      <img src={videoConfig.thumbnail} alt="Thumbnail" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-8 h-8 rounded-lg bg-arc-success/10 border border-arc-success/25 flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-arc-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{activeFile.name}</p>
                      <p className="text-xs text-arc-muted mt-0.5">
                        {(activeFile.size / 1024 / 1024).toFixed(1)} MB
                        {videoConfig && (
                          <> · {Math.floor(videoConfig.trimStart / 60)}:{String(Math.floor(videoConfig.trimStart % 60)).padStart(2, '0')}
                          {' → '}
                          {Math.floor(videoConfig.trimEnd / 60)}:{String(Math.floor(videoConfig.trimEnd % 60)).padStart(2, '0')}
                          {' · '}{videoConfig.quality}{videoConfig.slowMotion ? ' · 0.5×' : ''}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {canEnhance && (
                        <button
                          onClick={() => setShowEditor(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gold/30 text-gold text-xs hover:bg-gold-muted transition-all"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {enhancedFile || videoConfig ? 'Re-edit' : 'Enhance'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFile(null);
                          setEnhancedFile(null);
                          setPreviewDataUrl(null);
                          setVideoConfig(null);
                          if (fileRef.current) fileRef.current.value = '';
                        }}
                        className="p-1.5 rounded-lg text-arc-muted hover:text-white hover:bg-white/8 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={
                  contentType === 'image'
                    ? 'image/*'
                    : contentType === 'video'
                    ? 'video/*'
                    : contentType === 'audio'
                    ? 'audio/*'
                    : '.pdf,.txt,.md'
                }
                onChange={handleFileChange}
              />
            </div>

            {/* Pricing */}
            <PricingPanel config={pricingConfig} onChange={setPricingConfig} />

            {/* Draft creation progress */}
            {status === 'creating_draft' && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20">
                <svg className="animate-spin h-4 w-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-xs text-arc-secondary">Securing your draft…</p>
              </div>
            )}

            {/* Upload progress */}
            {(status === 'uploading' || status === 'retrying') && (
              <div className="card-surface p-5 rounded-xl">
                {status === 'retrying' && (
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 animate-spin" />
                    <p className="text-xs text-amber-400 font-medium">
                      Connection interrupted — retrying upload safely. Attempt {retryCount + 1} of {MAX_ATTEMPTS}.
                    </p>
                  </div>
                )}
                {status === 'retrying' && (
                  <p className="text-xs text-arc-muted mb-3">Your draft and edits are protected.</p>
                )}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-arc-secondary">
                    {status === 'retrying' ? 'Resuming upload…' : 'Uploading file…'}
                  </p>
                  <p className="text-xs font-medium text-gold">{uploadProgress}%</p>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {status === 'saving' && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20">
                <svg className="animate-spin h-4 w-4 text-gold flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-xs text-arc-secondary">Submitting for review…</p>
              </div>
            )}

            {/* Audio storage notice */}
            {contentType === 'audio' && activeFile && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/10">
                <AlertCircle className="w-4 h-4 text-arc-muted flex-shrink-0 mt-0.5" />
                <p className="text-xs text-arc-muted leading-relaxed">
                  Audio playback requires cloud storage. Your submission will be saved and reviewed — full delivery
                  activates once storage is configured. The review team will be notified.
                </p>
              </div>
            )}

            {/* Error */}
            {uploadError && (
              <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-400/80 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">Upload interrupted.</p>
                    <p className="text-xs text-arc-secondary mt-0.5 leading-relaxed">
                      {draftId
                        ? 'Your draft is protected. Retry to continue where you left off.'
                        : 'Your work is preserved. Retry or continue editing below.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-7 flex-wrap">
                  <button
                    onClick={() => handleSave()}
                    disabled={busy || !title.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/15 transition-all disabled:opacity-50"
                  >
                    {draftId ? 'Resume Upload' : 'Retry'}
                  </button>
                  <button
                    onClick={() => setUploadError('')}
                    className="text-xs px-3 py-1.5 rounded-lg text-arc-muted hover:text-arc-secondary transition-all"
                  >
                    Continue Editing
                  </button>
                  <button
                    onClick={() => setShowErrorDetails(v => !v)}
                    className="text-xs flex items-center gap-1 text-arc-muted hover:text-arc-secondary transition-all ml-auto"
                  >
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showErrorDetails ? 'rotate-180' : ''}`} />
                    Diagnostics
                  </button>
                </div>
                {showErrorDetails && (
                  <div className="mt-3 ml-7 px-3 py-2.5 rounded-lg bg-white/4 border border-white/6">
                    <p className="text-[11px] font-mono text-arc-muted leading-relaxed break-all">{uploadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pb-10">
              <button
                onClick={saveDraft}
                disabled={busy || (!title.trim() && !activeFile)}
                className="btn-outline px-5 py-3.5 flex items-center gap-2 text-sm flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {draftSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {draftSaved ? 'Saved' : 'Save Draft'}
              </button>
              <button
                onClick={handleSave}
                disabled={busy || !title.trim()}
                className="btn-gold flex-1 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {status === 'creating_draft'
                  ? 'Securing Draft…'
                  : status === 'uploading'
                  ? `Uploading… ${uploadProgress}%`
                  : status === 'retrying'
                  ? `Retrying… (${retryCount}/${MAX_ATTEMPTS - 1})`
                  : status === 'saving'
                  ? 'Submitting…'
                  : draftId
                  ? 'Resume & Submit'
                  : 'Submit for Review'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
