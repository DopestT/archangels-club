import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, Check, Sparkles } from 'lucide-react';

interface Props {
  file: File;
  onSave: (editedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

type PresetId = 'none' | 'luxe' | 'noir' | 'warm' | 'cool' | 'fade' | 'vivid' | 'cinema' | 'golden';
type CropRatio = 'original' | '1:1' | '4:3' | '16:9';

const PRESETS: { id: PresetId; label: string; filter: string }[] = [
  { id: 'none',   label: 'Original', filter: '' },
  { id: 'luxe',   label: 'Luxe',     filter: 'contrast(1.08) saturate(1.3) brightness(1.05)' },
  { id: 'noir',   label: 'Noir',     filter: 'grayscale(100%) contrast(1.3) brightness(0.92)' },
  { id: 'warm',   label: 'Warm',     filter: 'sepia(20%) saturate(1.5) brightness(1.06)' },
  { id: 'cool',   label: 'Cool',     filter: 'saturate(0.8) brightness(1.06) hue-rotate(15deg)' },
  { id: 'fade',   label: 'Fade',     filter: 'brightness(1.12) contrast(0.85) saturate(0.7)' },
  { id: 'vivid',  label: 'Vivid',    filter: 'saturate(1.8) contrast(1.1) brightness(1.02)' },
  { id: 'cinema', label: 'Cinema',   filter: 'contrast(1.2) saturate(0.78) brightness(0.88) sepia(8%)' },
  { id: 'golden', label: 'Golden',   filter: 'sepia(35%) saturate(1.6) brightness(1.08)' },
];

const CROP_RATIOS: { id: CropRatio; label: string }[] = [
  { id: 'original', label: 'Free' },
  { id: '1:1',      label: '1:1' },
  { id: '4:3',      label: '4:3' },
  { id: '16:9',     label: '16:9' },
];

export default function ImageEditor({ file, onSave, onCancel }: Props) {
  const [imgUrl, setImgUrl] = useState('');
  const [activePreset, setActivePreset] = useState<PresetId>('none');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [sharpness, setSharpness] = useState(50);
  const [cropRatio, setCropRatio] = useState<CropRatio>('original');
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function buildFilter(): string {
    const preset = PRESETS.find((p) => p.id === activePreset)?.filter ?? '';
    const parts: string[] = preset ? [preset] : [];
    if (brightness !== 100) parts.push(`brightness(${brightness / 100})`);
    if (contrast !== 100) parts.push(`contrast(${contrast / 100})`);
    if (saturation !== 100) parts.push(`saturate(${saturation / 100})`);
    if (sharpness < 45) parts.push(`blur(${((45 - sharpness) / 45) * 1.5}px)`);
    else if (sharpness > 55) parts.push(`contrast(${1 + (sharpness - 55) / 180})`);
    return parts.join(' ') || 'none';
  }

  function reset() {
    setActivePreset('none');
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setSharpness(50);
    setCropRatio('original');
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);

    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

    const applyRatio = (ratio: number) => {
      if (sw / sh > ratio) {
        const nw = sh * ratio;
        sx += (sw - nw) / 2;
        sw = nw;
      } else {
        const nh = sw / ratio;
        sy += (sh - nh) / 2;
        sh = nh;
      }
    };

    if (cropRatio === '1:1') applyRatio(1);
    else if (cropRatio === '4:3') applyRatio(4 / 3);
    else if (cropRatio === '16:9') applyRatio(16 / 9);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d')!;
    ctx.filter = buildFilter();
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const previewUrl = canvas.toDataURL('image/jpeg', 0.9);
    canvas.toBlob((blob) => {
      if (blob) {
        const ext = file.name.match(/\.[^.]+$/) ?? ['.jpg'];
        const editedFile = new File([blob], file.name.replace(/\.[^.]+$/, ext[0]), { type: 'image/jpeg' });
        onSave(editedFile, previewUrl);
      }
      setSaving(false);
    }, 'image/jpeg', 0.92);
  }

  const filterString = buildFilter();

  const cropWrapStyle: React.CSSProperties =
    cropRatio === 'original'
      ? { maxWidth: '100%', maxHeight: '100%' }
      : (() => {
          const [w, h] = cropRatio.split(':').map(Number);
          return { aspectRatio: `${w}/${h}`, overflow: 'hidden', maxWidth: '100%', maxHeight: '100%' };
        })();

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#09090B' }}>

      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-white/8 flex-shrink-0">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-white/8 transition-all text-arc-muted hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="font-serif text-white">Enhance Photo</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-arc-muted hover:text-white border border-white/10 rounded-lg transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: '#D4AF37', color: '#0A0A0F' }}
          >
            {saving ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save Edits
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-10 overflow-hidden min-h-0" style={{ background: '#0A0A0F' }}>
          <div style={cropWrapStyle}>
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="Preview"
                className="w-full h-full object-cover"
                style={{ filter: filterString }}
                crossOrigin="anonymous"
              />
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full md:w-72 lg:w-80 border-t md:border-t-0 md:border-l border-white/8 overflow-y-auto flex-shrink-0 bg-bg-surface">

          {/* Filter Presets */}
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted mb-3">Filters</p>
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setActivePreset(preset.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-1.5"
                >
                  <div className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    activePreset === preset.id ? 'border-gold' : 'border-transparent hover:border-white/20'
                  }`}>
                    {imgUrl && (
                      <img
                        src={imgUrl}
                        alt={preset.label}
                        className="w-full h-full object-cover"
                        style={{ filter: preset.filter || 'none' }}
                      />
                    )}
                  </div>
                  <span className={`text-[10px] font-medium ${activePreset === preset.id ? 'text-gold' : 'text-arc-muted'}`}>
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Adjustments */}
          <div className="p-4 border-b border-white/5">
            <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted mb-4">Adjustments</p>
            <div className="space-y-5">
              {([
                { label: 'Brightness', value: brightness, set: setBrightness, min: 0, max: 200, default: 100 },
                { label: 'Contrast',   value: contrast,   set: setContrast,   min: 0, max: 200, default: 100 },
                { label: 'Saturation', value: saturation, set: setSaturation, min: 0, max: 200, default: 100 },
                { label: 'Sharpness',  value: sharpness,  set: setSharpness,  min: 0, max: 100, default: 50  },
              ] as const).map(({ label, value, set, min, max, default: def }) => {
                const pct = ((value - min) / (max - min)) * 100;
                return (
                  <div key={label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-arc-secondary">{label}</span>
                      <span className={`text-xs font-mono ${value !== def ? 'text-gold' : 'text-arc-muted'}`}>
                        {value !== def ? (value > def ? `+${value - def}` : value - def) : '—'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                      className="w-full h-1 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: '#D4AF37',
                        background: `linear-gradient(to right, #D4AF37 ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
                      }}
                    />
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[9px] text-arc-muted">{label === 'Sharpness' ? 'Soft' : 'Low'}</span>
                      <span className="text-[9px] text-arc-muted">{label === 'Sharpness' ? 'Sharp' : 'High'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Crop */}
          <div className="p-4">
            <p className="text-[10px] font-bold tracking-widest uppercase text-arc-muted mb-3">Crop</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CROP_RATIOS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setCropRatio(id)}
                  className={`py-2 rounded-lg border text-xs transition-all ${
                    cropRatio === id
                      ? 'border-gold bg-gold-muted text-gold'
                      : 'border-white/10 text-arc-muted hover:border-white/20 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
