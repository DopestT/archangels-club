import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Scissors, Gauge, Zap, Check, AlertTriangle, Video } from 'lucide-react';
import type { VideoProcessingConfig } from '../../types';

interface Props {
  file: File;
  onSave: (config: VideoProcessingConfig) => void;
  onCancel: () => void;
}

const MAX_DURATION = 30;

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoProcessor({ file, onSave, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [quality, setQuality] = useState<'high' | 'standard' | 'compact'>('standard');
  const [slowMotion, setSlowMotion] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [capturingThumb, setCapturingThumb] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleMetadata() {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(d);
    setTrimEnd(Math.min(d, MAX_DURATION));
  }

  function captureThumbnail() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturingThumb(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setThumbnail(canvas.toDataURL('image/jpeg', 0.85));
    setTimeout(() => setCapturingThumb(false), 600);
  }

  const trimDuration = trimEnd - trimStart;
  const exceedsDuration = duration > MAX_DURATION;
  const trimPct = duration > 0 ? { start: (trimStart / duration) * 100, end: (trimEnd / duration) * 100 } : { start: 0, end: 100 };

  const QUALITIES = [
    { id: 'high' as const,     label: 'High',     sub: '~60 MB/min',   bitrate: '4 Mbps' },
    { id: 'standard' as const, label: 'Standard', sub: '~30 MB/min',   bitrate: '2 Mbps' },
    { id: 'compact' as const,  label: 'Compact',  sub: '~15 MB/min',   bitrate: '1 Mbps' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#09090B' }}>

      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/8 flex-shrink-0">
        <button onClick={onCancel} className="p-2 rounded-lg hover:bg-white/8 transition-all text-arc-muted hover:text-white">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-gold" />
          <span className="font-serif text-white">Process Video</span>
        </div>
        <button
          onClick={() => onSave({ trimStart, trimEnd, quality, slowMotion, thumbnail })}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium"
          style={{ background: '#D4AF37', color: '#0A0A0F' }}
        >
          <Check className="w-4 h-4" />
          Apply &amp; Continue
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

        {/* Video preview */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 gap-4 overflow-hidden min-h-0" style={{ background: '#0A0A0F' }}>
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              className="max-w-full max-h-[50vh] rounded-xl"
              onLoadedMetadata={handleMetadata}
              style={{ background: '#000' }}
            />
          )}

          {exceedsDuration && (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 max-w-md text-center">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Video exceeds 30 seconds. Use the trim tool to select your clip.
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-white/8 overflow-y-auto flex-shrink-0 bg-bg-surface">

          {/* Trim */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <Scissors className="w-4 h-4 text-gold" />
              <p className="text-sm font-medium text-white">Trim</p>
              <span className="ml-auto text-xs text-arc-muted">
                {formatTime(trimDuration)}
                {trimDuration > MAX_DURATION && (
                  <span className="text-arc-error ml-1">↑ max {MAX_DURATION}s</span>
                )}
              </span>
            </div>

            {/* Timeline visual */}
            <div className="relative h-3 bg-white/5 rounded-full mb-4 overflow-hidden">
              <div
                className="absolute h-full rounded-full"
                style={{
                  left: `${trimPct.start}%`,
                  width: `${trimPct.end - trimPct.start}%`,
                  background: 'rgba(212,175,55,0.4)',
                }}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-arc-secondary">Start</span>
                  <span className="text-gold font-mono">{formatTime(trimStart)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(duration - 1, 0)}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTrimStart(v);
                    if (trimEnd - v > MAX_DURATION) setTrimEnd(v + MAX_DURATION);
                  }}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: '#D4AF37',
                    background: `linear-gradient(to right, #D4AF37 ${duration > 0 ? (trimStart / duration) * 100 : 0}%, rgba(255,255,255,0.08) ${duration > 0 ? (trimStart / duration) * 100 : 0}%)`,
                  }}
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-arc-secondary">End</span>
                  <span className="text-gold font-mono">{formatTime(trimEnd)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={duration || MAX_DURATION}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTrimEnd(v);
                    if (v - trimStart > MAX_DURATION) setTrimStart(Math.max(0, v - MAX_DURATION));
                  }}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{
                    accentColor: '#D4AF37',
                    background: `linear-gradient(to right, #D4AF37 ${duration > 0 ? (trimEnd / duration) * 100 : 100}%, rgba(255,255,255,0.08) ${duration > 0 ? (trimEnd / duration) * 100 : 100}%)`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-gold" />
              <p className="text-sm font-medium text-white">Thumbnail</p>
            </div>
            <div className="flex items-start gap-3">
              {thumbnail ? (
                <img src={thumbnail} alt="Thumbnail" className="w-20 h-14 object-cover rounded-lg border border-white/10 flex-shrink-0" />
              ) : (
                <div className="w-20 h-14 rounded-lg border border-white/10 bg-white/3 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-5 h-5 text-arc-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-arc-secondary mb-2">Scrub to the frame you want, then capture.</p>
                <button
                  onClick={captureThumbnail}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    capturingThumb
                      ? 'border-arc-success/25 text-arc-success bg-arc-success/10'
                      : 'border-white/10 text-arc-secondary hover:border-gold/30 hover:text-white'
                  }`}
                >
                  {capturingThumb ? <Check className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                  {capturingThumb ? 'Captured' : 'Capture Frame'}
                </button>
              </div>
            </div>
          </div>

          {/* Compression */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-gold" />
              <p className="text-sm font-medium text-white">Compression</p>
            </div>
            <div className="space-y-2">
              {QUALITIES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuality(q.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all ${
                    quality === q.id ? 'border-gold bg-gold-muted' : 'border-white/10 hover:border-white/20 hover:bg-bg-hover'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${quality === q.id ? 'text-gold' : 'text-white'}`}>{q.label}</p>
                    <p className="text-xs text-arc-muted mt-0.5">{q.sub}</p>
                  </div>
                  <span className={`text-xs font-mono ${quality === q.id ? 'text-gold' : 'text-arc-muted'}`}>{q.bitrate}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Slow Motion */}
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-gold" />
                <div>
                  <p className="text-sm font-medium text-white">Slow Motion</p>
                  <p className="text-xs text-arc-muted">0.5× speed</p>
                </div>
              </div>
              <button
                onClick={() => setSlowMotion(!slowMotion)}
                disabled={trimDuration > 15}
                className={`relative w-10 h-5.5 rounded-full transition-all duration-200 disabled:opacity-40 ${
                  slowMotion ? 'bg-gold' : 'bg-white/10'
                }`}
                style={{ height: '22px' }}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  slowMotion ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>
            {trimDuration > 15 && (
              <p className="text-xs text-arc-muted mt-2">Trim to under 15 seconds to enable slow motion.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
