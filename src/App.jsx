import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PALETTES, PALETTE_KEYS, parseHexColors, generateRandomPalette } from './palettes';
import { processImage, drawGrid, countUniqueColors, computeHistogram, exportSVG, createScaledCanvas } from './engine';

// ─── Icons ─────────────────────────────────────────────────
const UploadIcon = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);
const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);
const DitheringIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="18" cy="6" r="1.5" fill="currentColor"/>
    <circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="6" cy="18" r="1.5" fill="currentColor"/>
    <circle cx="18" cy="18" r="1.5" fill="currentColor"/>
  </svg>
);
const ResetIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const UndoIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);
const RedoIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
  </svg>
);
const ZoomResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);
const FullscreenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
);

// ─── Reusable UI ───────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.12em] uppercase"
      style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
      {children}
    </span>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <SectionLabel>{label}</SectionLabel>
        <span className="text-[11px] font-mono tabular-nums"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>
          {value}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Toggle({ label, icon, checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-all duration-200 w-full cursor-pointer"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: checked ? 'var(--accent-dim)' : 'transparent',
        color: checked ? 'var(--accent)' : 'var(--text-secondary)',
        border: `1px solid ${checked ? 'rgba(200,230,74,0.25)' : 'var(--border-subtle)'}`,
      }}>
      {icon}<span>{label}</span>
      <div className="ml-auto w-8 h-[18px] rounded-full relative transition-all duration-200"
        style={{ background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.08)' }}>
        <div className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200"
          style={{ background: checked ? 'var(--bg-primary)' : 'var(--text-tertiary)', left: checked ? '14px' : '2px' }} />
      </div>
    </button>
  );
}

function MiniSelect({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{label}</SectionLabel>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg text-[12px] cursor-pointer outline-none"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
        }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Collapsible Section ───────────────────────────────────
function CollapsibleSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between cursor-pointer px-4 py-3">
        <SectionLabel>{title}</SectionLabel>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden px-4 pb-4 flex flex-col gap-2.5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Toast System ──────────────────────────────────────────
let toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);
  return { toasts, show };
}

function ToastContainer({ toasts }) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="px-5 py-2.5 rounded-xl text-[12px] font-medium shadow-lg"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--accent)', color: 'var(--bg-primary)',
              boxShadow: '0 4px 20px rgba(200,230,74,0.3)',
            }}>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Histogram Component ───────────────────────────────────
function Histogram({ data }) {
  if (!data) return null;
  const maxVal = Math.max(
    ...Array.from(data.r).slice(1, 255),
    ...Array.from(data.g).slice(1, 255),
    ...Array.from(data.b).slice(1, 255),
    1,
  );
  const step = 4; // sample every 4th bin
  const bins = [];
  for (let i = 0; i < 256; i += step) {
    bins.push({
      r: data.r[i] / maxVal,
      g: data.g[i] / maxVal,
      b: data.b[i] / maxVal,
    });
  }
  return (
    <div className="flex items-end gap-[1px] h-[40px] w-full rounded-lg overflow-hidden px-1"
      style={{ background: 'var(--bg-primary)' }}>
      {bins.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end gap-[0.5px]" style={{ minWidth: 0 }}>
          <div style={{ height: `${Math.max(1, b.r * 100)}%`, background: 'rgba(255,80,80,0.7)' }} />
          <div style={{ height: `${Math.max(1, b.g * 100)}%`, background: 'rgba(80,255,80,0.7)' }} />
          <div style={{ height: `${Math.max(1, b.b * 100)}%`, background: 'rgba(80,120,255,0.7)' }} />
        </div>
      ))}
    </div>
  );
}

// ─── Palette Selector ──────────────────────────────────────
function PaletteSelector({ selected, onSelect, customText, onCustomTextChange, onRandomPalette }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center justify-between cursor-pointer">
        <SectionLabel>Palette</SectionLabel>
        <ChevronIcon open={expanded} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden flex flex-col gap-1">
            {PALETTE_KEYS.map((key) => {
              const p = PALETTES[key];
              const isActive = selected === key;
              return (
                <div key={key}>
                  <button onClick={() => onSelect(key)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 cursor-pointer text-left w-full"
                    style={{
                      background: isActive ? 'var(--accent-dim)' : 'transparent',
                      border: `1px solid ${isActive ? 'rgba(200,230,74,0.25)' : 'transparent'}`,
                    }}>
                    <span className="text-sm shrink-0 w-5 text-center">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold" style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                      }}>{p.name}</div>
                      <div className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>{p.description}</div>
                    </div>
                    {p.colors && (
                      <div className="flex gap-[3px] shrink-0">
                        {p.colors.slice(0, 6).map((c, i) => (
                          <div key={i} className="w-2.5 h-2.5 rounded-sm"
                            style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }} />
                        ))}
                      </div>
                    )}
                  </button>
                  {key === 'custom' && isActive && (
                    <div className="px-3.5 pb-2 pt-1">
                      <input type="text" value={customText} onChange={(e) => onCustomTextChange(e.target.value)}
                        placeholder="#ff0000, #00ff00, #0000ff"
                        className="w-full px-3 py-2 rounded-lg text-[11px] outline-none"
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          background: 'var(--bg-primary)', color: 'var(--text-primary)',
                          border: '1px solid var(--border-subtle)',
                        }} />
                    </div>
                  )}
                </div>
              );
            })}
            {/* Random palette button */}
            <button onClick={onRandomPalette}
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}>
              <span className="text-base shrink-0 w-6 text-center">🎲</span>
              <span>Random Palette</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Keyboard Shortcut Modal ───────────────────────────────
function ShortcutsModal({ onClose }) {
  const shortcuts = [
    ['G', 'Toggle grid overlay'],
    ['D', 'Toggle dithering'],
    ['I', 'Toggle invert colors'],
    ['+', 'Increase pixel size'],
    ['-', 'Decrease pixel size'],
    ['F', 'Toggle fullscreen canvas'],
    ['Ctrl+Z', 'Undo'],
    ['Ctrl+Shift+Z', 'Redo'],
    ['?', 'Show shortcuts'],
    ['Esc', 'Close modal / exit fullscreen'],
  ];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-[18px] cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <div className="flex flex-col gap-2">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-1.5">
              <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{desc}</span>
              <kbd className="px-2.5 py-1 rounded-md text-[11px] font-semibold"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  background: 'var(--bg-primary)', color: 'var(--accent)',
                  border: '1px solid var(--border-subtle)',
                }}>{key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Preset Modal ──────────────────────────────────────────
function PresetModal({ onClose, onLoad, presets, currentSettings, onSave, onDelete }) {
  const [name, setName] = useState('');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold">Presets</h2>
          <button onClick={onClose} className="text-[18px] cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        {/* Save new */}
        <div className="flex gap-2 mb-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()); setName(''); } }}
          />
          <button onClick={() => { if (name.trim()) { onSave(name.trim()); setName(''); } }}
            className="px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--accent)', color: 'var(--bg-primary)',
            }}>Save</button>
        </div>
        {/* List */}
        <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto">
          {presets.length === 0 && (
            <p className="text-[12px] py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>No saved presets</p>
          )}
          {presets.map((p) => (
            <div key={p.name}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[12px] font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</span>
              <div className="flex gap-2">
                <button onClick={() => onLoad(p)}
                  className="px-3 py-1 rounded-md text-[10px] font-medium cursor-pointer"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>Load</button>
                <button onClick={() => onDelete(p.name)}
                  className="px-3 py-1 rounded-md text-[10px] font-medium cursor-pointer"
                  style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────
const DEFAULT_STATE = {
  pixelSize: 8, paletteKey: 'original', dithering: false, brightness: 0, contrast: 0,
  showGrid: false, sharpen: 0, blur: 0, hueRotation: 0, saturation: 0,
  invertColors: false, sepia: false, grayscale: false, posterize: 256,
  pixelShape: 'square', exportScale: 1, bgColor: '#0a0a0f', customPaletteText: '',
};

export default function App() {
  // ─── Core State ────────────────────────────────────────
  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState('');
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);

  // ─── Settings State ────────────────────────────────────
  const [settings, _setSettings] = useState({ ...DEFAULT_STATE });

  // ─── History (undo/redo) ───────────────────────────────
  const historyRef = useRef([{ ...DEFAULT_STATE }]);
  const historyIdxRef = useRef(0);

  const setSettings = useCallback((updater) => {
    _setSettings((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      // Push to history
      const h = historyRef.current;
      const idx = historyIdxRef.current;
      historyRef.current = [...h.slice(0, idx + 1), { ...next }].slice(-50);
      historyIdxRef.current = historyRef.current.length - 1;
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    const idx = historyIdxRef.current;
    if (idx > 0) {
      historyIdxRef.current = idx - 1;
      _setSettings({ ...historyRef.current[idx - 1] });
    }
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    const idx = historyIdxRef.current;
    if (idx < h.length - 1) {
      historyIdxRef.current = idx + 1;
      _setSettings({ ...h[idx + 1] });
    }
  }, []);

  // Destructure for convenience
  const {
    pixelSize, paletteKey, dithering, brightness, contrast, showGrid,
    sharpen, blur, hueRotation, saturation, invertColors, sepia, grayscale, posterize,
    pixelShape, exportScale, bgColor, customPaletteText,
  } = settings;

  const set = useCallback((key, val) => setSettings((s) => ({ ...s, [key]: val })), [setSettings]);

  // ─── Zoom/Pan State ────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // ─── UI State ──────────────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [compPos, setCompPos] = useState(50);
  const { toasts, show: showToast } = useToast();

  // ─── Analytics State ───────────────────────────────────
  const [colorCount, setColorCount] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const [histogramData, setHistogramData] = useState(null);

  // ─── Presets ───────────────────────────────────────────
  const [presets, setPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pf_presets') || '[]'); } catch { return []; }
  });
  const savePreset = useCallback((name) => {
    const p = [...presets.filter((x) => x.name !== name), { name, settings: { ...settings } }];
    setPresets(p);
    localStorage.setItem('pf_presets', JSON.stringify(p));
    showToast('Settings saved');
  }, [presets, settings, showToast]);
  const loadPreset = useCallback((p) => {
    setSettings(p.settings);
    showToast(`Loaded "${p.name}"`);
  }, [setSettings, showToast]);
  const deletePreset = useCallback((name) => {
    const p = presets.filter((x) => x.name !== name);
    setPresets(p);
    localStorage.setItem('pf_presets', JSON.stringify(p));
  }, [presets]);

  // ─── Recent Images ────────────────────────────────────
  const [recentImages, setRecentImages] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pf_recent') || '[]'); } catch { return []; }
  });

  // ─── Refs ──────────────────────────────────────────────
  const sourceCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const compSourceRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const animFrameRef = useRef(null);

  // ─── Load Image ────────────────────────────────────────
  const loadImage = useCallback(async (file) => {
    setProcessing(true);
    let processedFile = file;
    const name = file.name.toLowerCase();
    const type = file.type;

    // ── HEIC/HEIF (iPhone) — convert to JPEG ──
    const isHeic = type === 'image/heic' || type === 'image/heif'
      || /\.(heic|heif)$/i.test(name);
    if (isHeic) {
      try {
        const { default: heic2any } = await import('heic2any');
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
        processedFile = new File(
          [Array.isArray(blob) ? blob[0] : blob],
          file.name.replace(/\.(heic|heif)$/i, '.jpg'),
          { type: 'image/jpeg' }
        );
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        setProcessing(false);
        return;
      }
    }

    // ── WebP, AVIF, BMP, ICO, SVG, TIFF — browsers handle most natively via <img> ──
    // If the browser can't decode it, img.onerror fires and we show a toast

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        setProcessing(false);
        showToast('Unsupported format — try converting to PNG first');
      };
      img.onload = () => {
        setImageName(file.name);
        setImageSize({ w: img.width, h: img.height });
        const canvas = sourceCanvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        setImage(img);
        setProcessing(false);
        setZoom(1); setPan({ x: 0, y: 0 });
        // Save to recent
        const thumb = e.target.result;
        setRecentImages((prev) => {
          const next = [{ name: file.name, data: thumb }, ...prev.filter(r => r.name !== file.name)].slice(0, 3);
          try { localStorage.setItem('pf_recent', JSON.stringify(next)); } catch { /* quota */ }
          return next;
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const loadFromDataUrl = useCallback((dataUrl, name) => {
    setProcessing(true);
    const img = new Image();
    img.onload = () => {
      setImageName(name);
      setImageSize({ w: img.width, h: img.height });
      const canvas = sourceCanvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      setImage(img);
      setProcessing(false);
      setZoom(1); setPan({ x: 0, y: 0 });
    };
    img.src = dataUrl;
  }, []);

  // ─── Custom palette colors ────────────────────────────
  const customColors = useMemo(() => parseHexColors(customPaletteText), [customPaletteText]);

  // ─── bg color parse ───────────────────────────────────
  const bgColorRgb = useMemo(() => {
    const hex = bgColor.replace('#', '');
    if (hex.length !== 6) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }, [bgColor]);

  // ─── Render ────────────────────────────────────────────
  const render = useCallback(() => {
    if (!image || !outputCanvasRef.current || !sourceCanvasRef.current) return;
    const t0 = performance.now();
    const outCanvas = outputCanvasRef.current;
    outCanvas.width = sourceCanvasRef.current.width;
    outCanvas.height = sourceCanvasRef.current.height;
    const ctx = outCanvas.getContext('2d');

    let palette = null;
    if (paletteKey === 'custom') {
      palette = customColors;
    } else {
      palette = PALETTES[paletteKey]?.colors || null;
    }

    const { imageData, cols, rows, output } = processImage({
      sourceCanvas: sourceCanvasRef.current, pixelSize, palette, dithering, brightness, contrast,
      sharpen, blur, hueRotation, saturation,
      invert: invertColors, sepia, grayscale, posterize,
      pixelShape, bgColor: (pixelShape !== 'square') ? bgColorRgb : null,
    });
    ctx.putImageData(imageData, 0, 0);
    if (showGrid && pixelSize > 2) drawGrid(ctx, outCanvas.width, outCanvas.height, pixelSize);

    const dt = performance.now() - t0;
    setRenderTime(Math.round(dt * 10) / 10);
    setColorCount(countUniqueColors(output, cols * rows));
    setHistogramData(computeHistogram(output, cols * rows));

    // Comparison source
    if (showComparison && compSourceRef.current) {
      const cs = compSourceRef.current;
      cs.width = sourceCanvasRef.current.width;
      cs.height = sourceCanvasRef.current.height;
      cs.getContext('2d').drawImage(sourceCanvasRef.current, 0, 0);
    }
  }, [
    image, pixelSize, paletteKey, dithering, brightness, contrast, showGrid,
    sharpen, blur, hueRotation, saturation, invertColors, sepia, grayscale, posterize,
    pixelShape, customColors, bgColorRgb, showComparison,
  ]);

  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(render);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [render]);

  // ─── Drag/Drop Handlers ────────────────────────────────
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith('image/')) loadImage(f);
  }, [loadImage]);
  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleFileSelect = useCallback((e) => { const f = e.target.files[0]; if (f) loadImage(f); }, [loadImage]);

  // ─── Export PNG ────────────────────────────────────────
  const handleExport = useCallback(() => {
    if (!outputCanvasRef.current) return;
    const scaled = exportScale > 1
      ? createScaledCanvas(outputCanvasRef.current, exportScale)
      : outputCanvasRef.current;
    const link = document.createElement('a');
    const name = imageName ? imageName.replace(/\.[^.]+$/, '') : 'pixelforge';
    link.download = `${name}_${PALETTES[paletteKey]?.name?.toLowerCase() || paletteKey}_${pixelSize}px_${exportScale}x.png`;
    link.href = scaled.toDataURL('image/png');
    link.click();
    showToast('Exported!');
  }, [imageName, paletteKey, pixelSize, exportScale, showToast]);

  // ─── Export SVG ────────────────────────────────────────
  const handleExportSVG = useCallback(() => {
    if (!outputCanvasRef.current || !sourceCanvasRef.current) return;
    // Re-process to get output buffer
    let palette = paletteKey === 'custom' ? customColors : (PALETTES[paletteKey]?.colors || null);
    const { output, cols, rows } = processImage({
      sourceCanvas: sourceCanvasRef.current, pixelSize, palette, dithering, brightness, contrast,
      sharpen, blur, hueRotation, saturation,
      invert: invertColors, sepia, grayscale, posterize, pixelShape,
    });
    const svg = exportSVG(output, cols, rows, pixelSize);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    const name = imageName ? imageName.replace(/\.[^.]+$/, '') : 'pixelforge';
    link.download = `${name}_${pixelSize}px.svg`;
    link.href = URL.createObjectURL(blob);
    link.click();
    showToast('Exported SVG!');
  }, [imageName, paletteKey, pixelSize, dithering, brightness, contrast, sharpen, blur, hueRotation, saturation, invertColors, sepia, grayscale, posterize, pixelShape, customColors, showToast]);

  // ─── Copy to Clipboard ─────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!outputCanvasRef.current) return;
    try {
      const scaled = exportScale > 1
        ? createScaledCanvas(outputCanvasRef.current, exportScale)
        : outputCanvasRef.current;
      const blob = await new Promise((res) => scaled.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Copied!');
    } catch {
      showToast('Copy failed — browser blocked it');
    }
  }, [exportScale, showToast]);

  // ─── Reset ─────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_STATE });
    setZoom(1); setPan({ x: 0, y: 0 });
    setShowComparison(false);
  }, [setSettings]);

  // ─── Random Palette ────────────────────────────────────
  const handleRandomPalette = useCallback(() => {
    const colors = generateRandomPalette(8);
    const hex = colors.map((c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')).join(', ');
    setSettings((s) => ({ ...s, paletteKey: 'custom', customPaletteText: hex }));
    showToast('Random palette generated!');
  }, [setSettings, showToast]);

  // ─── Zoom via Wheel ────────────────────────────────────
  const handleWheel = useCallback((e) => {
    if (!image) return;
    e.preventDefault();
    setZoom((z) => Math.max(0.25, Math.min(10, z + (e.deltaY > 0 ? -0.15 : 0.15) * z)));
  }, [image]);

  // ─── Pan Handlers ──────────────────────────────────────
  const handleCanvasPointerDown = useCallback((e) => {
    if (zoom <= 1 || !image) return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.style.cursor = 'grabbing';
  }, [zoom, pan, image]);
  const handleCanvasPointerMove = useCallback((e) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.px + dx, y: panStartRef.current.py + dy });
  }, []);
  const handleCanvasPointerUp = useCallback((e) => {
    isPanningRef.current = false;
    if (e.currentTarget) e.currentTarget.style.cursor = zoom > 1 ? 'grab' : 'default';
  }, [zoom]);

  // ─── Comparison Slider ─────────────────────────────────
  const compDragging = useRef(false);
  const compContainerRef = useRef(null);
  const handleCompPointerDown = useCallback((e) => {
    compDragging.current = true;
    e.stopPropagation();
  }, []);
  const handleCompPointerMove = useCallback((e) => {
    if (!compDragging.current || !compContainerRef.current) return;
    const rect = compContainerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setCompPos(pct);
  }, []);
  const handleCompPointerUp = useCallback(() => { compDragging.current = false; }, []);

  useEffect(() => {
    if (showComparison) {
      window.addEventListener('pointermove', handleCompPointerMove);
      window.addEventListener('pointerup', handleCompPointerUp);
      return () => {
        window.removeEventListener('pointermove', handleCompPointerMove);
        window.removeEventListener('pointerup', handleCompPointerUp);
      };
    }
  }, [showComparison, handleCompPointerMove, handleCompPointerUp]);

  // ─── Keyboard Shortcuts ────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      // Don't capture when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.key === '?' && !e.ctrlKey) { setShowShortcuts((v) => !v); e.preventDefault(); return; }
      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showPresets) { setShowPresets(false); return; }
        if (fullscreen) { setFullscreen(false); return; }
        return;
      }
      if (e.key === 'g' || e.key === 'G') { set('showGrid', !showGrid); e.preventDefault(); return; }
      if (e.key === 'd' || e.key === 'D') { set('dithering', !dithering); e.preventDefault(); return; }
      if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey) { set('invertColors', !invertColors); e.preventDefault(); return; }
      if (e.key === 'f' || e.key === 'F') { setFullscreen((v) => !v); e.preventDefault(); return; }
      if (e.key === '+' || e.key === '=') { set('pixelSize', Math.min(64, pixelSize + 1)); e.preventDefault(); return; }
      if (e.key === '-') { set('pixelSize', Math.max(2, pixelSize - 1)); e.preventDefault(); return; }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { redo(); e.preventDefault(); return; }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); return; }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showGrid, dithering, invertColors, pixelSize, fullscreen, showShortcuts, showPresets, set, undo, redo]);

  // ─── Computed ──────────────────────────────────────────
  const pixelCount = image ? Math.ceil(imageSize.w / pixelSize) * Math.ceil(imageSize.h / pixelSize) : 0;

  // ─── Canvas Style (zoom/pan) ───────────────────────────
  const canvasStyle = {
    imageRendering: 'pixelated',
    boxShadow: '0 0 60px rgba(0,0,0,0.6)',
    border: '1px solid var(--border-subtle)',
    transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
    transformOrigin: 'center center',
    cursor: zoom > 1 ? 'grab' : 'default',
  };

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Header ─────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>⚒</div>
          <h1 className="text-[13px] font-semibold tracking-tight">PixelForge</h1>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>v2.0</span>
        </div>
        <div className="flex items-center gap-2">
          {image && zoom !== 1 && (
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer"
              style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              <ZoomResetIcon /> {Math.round(zoom * 100)}%
            </motion.button>
          )}
          {image && (
            <>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setFullscreen(!fullscreen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <FullscreenIcon />
              </motion.button>
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <ResetIcon /> Reset
              </motion.button>
            </>
          )}
        </div>
      </header>

      {/* ─── Main ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── Canvas Area ────────────────────────────────── */}
        <div ref={containerRef}
          className={`flex-[7] flex flex-col items-center justify-center p-6 relative ${fullscreen ? 'fullscreen-canvas' : ''}`}
          onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
          onWheel={handleWheel}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}>
          <canvas ref={sourceCanvasRef} className="hidden" />
          <canvas ref={compSourceRef} className="hidden" />

          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div key="upload" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 cursor-pointer rounded-2xl p-16 w-full max-w-lg transition-all"
                style={{ background: isDragging ? 'var(--accent-dim)' : 'var(--bg-secondary)', border: `2px dashed ${isDragging ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}` }}
                onClick={() => fileInputRef.current?.click()}>
                <div style={{ color: isDragging ? 'var(--accent)' : 'var(--text-tertiary)' }}><UploadIcon /></div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Drop an image here</p>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-tertiary)' }}>or click to browse · JPG, PNG, GIF, HEIC, WebP, AVIF, TIFF, BMP, SVG</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.tiff,.tif,.avif,.webp,.bmp,.ico" className="hidden" onChange={handleFileSelect} />
              </motion.div>
            ) : showComparison ? (
              <motion.div key="comparison" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                ref={compContainerRef}
                className="comparison-container flex items-center justify-center w-full h-full relative"
                style={{ maxWidth: '100%', maxHeight: '100%' }}>
                {/* Output canvas (full) */}
                <canvas ref={outputCanvasRef}
                  className="max-w-full max-h-full rounded-lg"
                  style={{ ...canvasStyle, position: 'relative' }} />
                {/* Original overlay clipped to left side */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0,
                  width: `${compPos}%`, overflow: 'hidden',
                  pointerEvents: 'none',
                }}>
                  <canvas ref={(el) => {
                    if (el && sourceCanvasRef.current) {
                      el.width = sourceCanvasRef.current.width;
                      el.height = sourceCanvasRef.current.height;
                      el.getContext('2d').drawImage(sourceCanvasRef.current, 0, 0);
                    }
                  }}
                    className="max-w-full max-h-full rounded-lg"
                    style={{ ...canvasStyle, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                {/* Divider */}
                <div className="comparison-divider"
                  style={{ left: `${compPos}%` }}
                  onPointerDown={handleCompPointerDown} />
              </motion.div>
            ) : (
              <motion.div key="canvas" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-center w-full h-full">
                <canvas ref={outputCanvasRef}
                  className="max-w-full max-h-full rounded-lg" style={canvasStyle} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drag overlay */}
          <AnimatePresence>
            {isDragging && image && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-6 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(200,230,74,0.06)', border: '2px dashed var(--accent)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Drop to replace</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Processing spinner */}
          {processing && (
            <div className="absolute inset-0 flex items-center justify-center z-30"
              style={{ background: 'rgba(10,10,15,0.8)' }}>
              <div className="flex flex-col items-center gap-3">
                <div className="spinner" />
                <span className="text-[12px]" style={{ color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>Processing...</span>
              </div>
            </div>
          )}

          {fullscreen && (
            <button onClick={() => setFullscreen(false)}
              className="absolute top-4 right-4 z-50 px-3 py-2 rounded-lg text-[11px] cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
              ESC
            </button>
          )}

          {/* Histogram below canvas */}
          {image && histogramData && !fullscreen && (
            <div className="w-full max-w-md mt-3">
              <Histogram data={histogramData} />
            </div>
          )}
        </div>

        {/* ─── Sidebar ──────────────────────────────────── */}
        {!fullscreen && (
          <motion.aside initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.1 }}
            className="w-[280px] shrink-0 overflow-y-auto flex flex-col"
            style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-subtle)' }}>

            {/* Pixel Size */}
            <div className="p-5 flex flex-col gap-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <Slider label="Pixel Size" value={pixelSize} onChange={(v) => set('pixelSize', v)} min={2} max={64} step={1} unit="px" />
            </div>

            {/* Palette */}
            <div className="p-5 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <PaletteSelector selected={paletteKey} onSelect={(v) => set('paletteKey', v)}
                customText={customPaletteText} onCustomTextChange={(v) => set('customPaletteText', v)}
                onRandomPalette={handleRandomPalette} />
            </div>

            {/* Options */}
            <div className="p-5 flex flex-col gap-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <SectionLabel>Options</SectionLabel>
              <Toggle label="Dithering" icon={<DitheringIcon />} checked={dithering} onChange={(v) => set('dithering', v)} />
              <Toggle label="Grid Overlay" icon={<GridIcon />} checked={showGrid} onChange={(v) => set('showGrid', v)} />
              <Toggle label="Invert Colors" icon={<span style={{ fontSize: 14 }}>◑</span>} checked={invertColors} onChange={(v) => set('invertColors', v)} />
              <Toggle label="Sepia" icon={<span style={{ fontSize: 14 }}>🤎</span>} checked={sepia} onChange={(v) => set('sepia', v)} />
              <Toggle label="Grayscale" icon={<span style={{ fontSize: 14 }}>⬜</span>} checked={grayscale} onChange={(v) => set('grayscale', v)} />
              <Toggle label="Comparison" icon={<span style={{ fontSize: 14 }}>⇔</span>}
                checked={showComparison} onChange={(v) => setShowComparison(v)} />
            </div>

            {/* Adjustments */}
            <CollapsibleSection title="Adjustments">
              <Slider label="Brightness" value={brightness} onChange={(v) => set('brightness', v)} min={-100} max={100} />
              <Slider label="Contrast" value={contrast} onChange={(v) => set('contrast', v)} min={-100} max={100} />
              <Slider label="Hue Rotation" value={hueRotation} onChange={(v) => set('hueRotation', v)} min={0} max={360} unit="°" />
              <Slider label="Saturation" value={saturation} onChange={(v) => set('saturation', v)} min={-100} max={100} />
            </CollapsibleSection>

            {/* Filters */}
            <CollapsibleSection title="Filters" defaultOpen={false}>
              <Slider label="Sharpen" value={sharpen} onChange={(v) => set('sharpen', v)} min={0} max={100} />
              <Slider label="Blur" value={blur} onChange={(v) => set('blur', v)} min={0} max={10} step={0.5} />
              <Slider label="Posterize" value={posterize} onChange={(v) => set('posterize', v)} min={2} max={256} unit=" levels" />
            </CollapsibleSection>

            {/* Shape & Background */}
            <CollapsibleSection title="Shape & Background" defaultOpen={false}>
              <MiniSelect label="Pixel Shape" value={pixelShape} onChange={(v) => set('pixelShape', v)}
                options={[
                  { value: 'square', label: 'Square' },
                  { value: 'circle', label: 'Circle' },
                  { value: 'diamond', label: 'Diamond' },
                ]} />
              <div className="flex flex-col gap-2">
                <SectionLabel>Canvas Background</SectionLabel>
                <div className="flex items-center gap-2">
                  <input type="color" value={bgColor} onChange={(e) => set('bgColor', e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0" style={{ background: 'transparent' }} />
                  <input type="text" value={bgColor} onChange={(e) => set('bgColor', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-[11px] outline-none"
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      background: 'var(--bg-primary)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }} />
                </div>
              </div>
            </CollapsibleSection>

            {/* Export Options */}
            <CollapsibleSection title="Export" defaultOpen={false}>
              <MiniSelect label="Export Scale" value={String(exportScale)} onChange={(v) => set('exportScale', Number(v))}
                options={[
                  { value: '1', label: '1x' },
                  { value: '2', label: '2x' },
                  { value: '4', label: '4x' },
                  { value: '8', label: '8x' },
                ]} />
              <div className="flex gap-2">
                <button onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <CopyIcon /> Copy
                </button>
                <button onClick={handleExportSVG} disabled={!image}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer disabled:opacity-30"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <DownloadIcon /> SVG
                </button>
              </div>
            </CollapsibleSection>

            {/* Presets & Undo */}
            <div className="p-5 flex gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setShowPresets(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-medium cursor-pointer"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                💾 Presets
              </button>
              <button onClick={undo}
                className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-[11px] font-medium cursor-pointer"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <UndoIcon />
              </button>
              <button onClick={redo}
                className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-[11px] font-medium cursor-pointer"
                style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                <RedoIcon />
              </button>
            </div>

            {/* Replace Image & Shortcuts */}
            {image && (
              <div className="p-5 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[12px] font-medium transition-all cursor-pointer"
                  style={{ fontFamily: "'JetBrains Mono', monospace", background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                  <UploadIcon size={16} /> Replace Image
                </button>
                <button onClick={() => setShowShortcuts(true)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[11px] font-medium cursor-pointer"
                  style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
                  ⌨ Shortcuts (?)
                </button>
                <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.tiff,.tif,.avif,.webp,.bmp,.ico" className="hidden" onChange={handleFileSelect} />
              </div>
            )}

            {/* Recent Images */}
            {recentImages.length > 0 && (
              <div className="p-5 flex flex-col gap-2 mt-auto">
                <SectionLabel>Recent Images</SectionLabel>
                <div className="flex gap-2">
                  {recentImages.map((r, i) => (
                    <img key={i} src={r.data} alt={r.name} className="recent-thumb"
                      onClick={() => loadFromDataUrl(r.data, r.name)}
                      title={r.name} />
                  ))}
                </div>
              </div>
            )}
          </motion.aside>
        )}
      </div>

      {/* ─── Footer ─────────────────────────────────────── */}
      {!fullscreen && (
        <footer className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-4">
            {image ? (
              <>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{imageSize.w}×{imageSize.h}</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                  {Math.ceil(imageSize.w / pixelSize)}×{Math.ceil(imageSize.h / pixelSize)} blocks
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--accent)' }}>{colorCount} colors</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{renderTime}ms</span>
              </>
            ) : (
              <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>No image loaded</span>
            )}
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleExport} disabled={!image}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: image ? 'var(--accent)' : 'var(--bg-tertiary)', color: image ? 'var(--bg-primary)' : 'var(--text-tertiary)' }}>
            <DownloadIcon /> Export
          </motion.button>
        </footer>
      )}

      {/* ─── Modals ─────────────────────────────────────── */}
      <AnimatePresence>
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showPresets && (
          <PresetModal onClose={() => setShowPresets(false)} presets={presets}
            currentSettings={settings} onSave={savePreset} onLoad={loadPreset} onDelete={deletePreset} />
        )}
      </AnimatePresence>

      {/* Toast container */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
