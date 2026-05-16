import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Upload, Image, Video, Music, FileText, ArrowLeft, Check, AlertCircle, Clock, Sparkles, X, Save } from 'lucide-react';
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

interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: 'image' | 'video' | 'raw';
  version: number;
}

function buildPreviewUrl(cloudName: string, result: CloudinaryUploadResult): string {
  const { public_id, resource_type, version } = result;
  const v = `v${version}`;
  if (resource_type === 'video') {
    return `https://res.cloudinary.com/${cloudName}/video/upload/so_3,e_blur:600,q_30,w_800/${v}/${public_id}.jpg`;
  }
  return `https://res.cloudinary.com/${cloudName}/image/upload/e_blur:1800,q_20,w_800/${v}/${public_id}`;
}

async function signUpload(token: string): Promise<{ signature: string; timestamp: number; api_key: string; cloud_name: string; folder: string }> {
  const res = await fetch(`${API_BASE}/api/upload/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Failed to get upload credentials.');
  return res.json();
}

function uploadToCloudinary(
  file: File,
  resourceType: 'image' | 'video' | 'raw',
  sign: Awaited<ReturnType<typeof signUpload>>,
  onProgress: (pct: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    form.append('api_key', sign.api_key);
    form.append('timestamp', String(sign.timestamp));
    form.append('signature', sign.signature);
    form.append('folder', sign.folder);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')));
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${sign.cloud_name}/${resourceType}/upload`);
    xhr.send(form);
  });
}

function toResourceType(contentType: ContentType): 'image' | 'video' | 'raw' {
  if (contentType === 'image') return 'image';
  if (contentType === 'video') return 'video';
  return 'raw';
}

export default function UploadContent() {
  const { token } = useAuth();
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
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'saving' | 'submitted'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [submittedTitle, setSubmittedTitle] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftNotice, setDraftNotice] = useState<{
    title: string;
    description: string;
    contentType: ContentType;
    pricingConfig: PricingConfig;
    savedAt: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeFile = enhancedFile ?? file;
  const canEnhance = file !== null && (contentType === 'image' || contentType === 'video');
  const busy = status === 'uploading' || status === 'processing' || status === 'saving';

  // Restore saved draft on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('arc_upload_draft');
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        title: string; description: string;
        contentType: ContentType; pricingConfig: PricingConfig; savedAt: string;
      };
      if (draft.title || draft.description) setDraftNotice(draft);
    } catch {
      localStorage.removeItem('arc_upload_draft');
    }
  }, []);

  function saveDraft() {
    try {
      localStorage.setItem('arc_upload_draft', JSON.stringify({
        title, description, contentType, pricingConfig,
        savedAt: new Date().toISOString(),
      }));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch {}
  }

  function restoreDraft() {
    if (!draftNotice) return;
    setTitle(draftNotice.title);
    setDescription(draftNotice.description);
    setContentType(draftNotice.contentType);
    setPricingConfig(draftNotice.pricingConfig);
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
    setUploadProgress(0);

    try {
      let mediaUrl: string | null = null;
      let previewUrl: string | null = previewDataUrl ?? null;

      if (activeFile) {
        setStatus('uploading');
        const sign = await signUpload(token);
        const result = await uploadToCloudinary(
          activeFile,
          toResourceType(contentType),
          sign,
          setUploadProgress,
        );
        mediaUrl = result.secure_url;
        if (!previewUrl) {
          previewUrl = buildPreviewUrl(sign.cloud_name, result);
        }
      }

      setStatus('saving');
      const res = await fetch(`${API_BASE}/api/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          content_type: contentType,
          access_type: pricingConfig.accessType,
          price: pricingConfig.price ?? 0,
          preview_url: previewUrl,
          media_url: mediaUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? 'Failed to submit content. Please try again.');
        setStatus('idle');
        return;
      }

      setSubmittedTitle(title.trim());
      localStorage.removeItem('arc_upload_draft');
      setStatus('submitted');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to reach the server.');
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
    setTitle('');
    setDescription('');
    setPricingConfig(DEFAULT_PRICING);
    setSubmittedTitle('');
  }

  if (status === 'submitted') {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-arc-success/10 border border-arc-success/30 flex items-center justify-center mx-auto mb-8">
            <Check className="w-9 h-9 text-arc-success" />
          </div>
          <span className="section-eyebrow mb-4 block">Published</span>
          <h1 className="font-serif text-3xl text-white">Your drop is live.</h1>
          <p className="text-arc-secondary leading-relaxed mb-8">
            <strong className="text-white">{submittedTitle}</strong> is now visible to members and available to unlock immediately.
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
                <p className="text-xs font-medium text-white">Saved draft found</p>
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

            {/* Upload progress */}
            {status === 'uploading' && (
              <div className="card-surface p-5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-arc-secondary">Uploading file…</p>
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
                <p className="text-xs text-arc-secondary">Saving content record…</p>
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
              <div className="flex items-start gap-3 p-4 rounded-xl bg-arc-error/10 border border-arc-error/30">
                <AlertCircle className="w-4 h-4 text-arc-error flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-arc-error">{uploadError}</p>
                  <p className="text-xs text-arc-muted mt-1">Your work is preserved — try again when ready.</p>
                </div>
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
                {status === 'uploading' ? `Uploading… ${uploadProgress}%` : status === 'saving' ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
