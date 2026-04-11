import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PALETTES, PALETTE_KEYS } from './palettes';
import { processImage, drawGrid } from './engine';

// ─── Icons (inline SVG) ────────────────────────────────────
const UploadIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

const DitheringIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="6" r="1" fill="currentColor"/>
    <circle cx="18" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/>
    <circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/>
    <circle cx="12" cy="18" r="1.5" fill="currentColor"/><circle cx="18" cy="18" r="1" fill="currentColor"/>
  </svg>
);

const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
  </svg>
);

// ─── Slider Component ──────────────────────────────────────
function Slider({ label, value, onChange, min, max, step = 1, unit = '' }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-xs font-mono tabular-nums" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent)' }}>
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

// ─── Toggle Component ──────────────────────────────────────
function Toggle({ label, icon, checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 w-full"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        background: checked ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
        color: checked ? 'var(--accent)' : 'var(--text-secondary)',
        border: `1px solid ${checked ? 'rgba(200,230,74,0.3)' : 'var(--border-subtle)'}`,
      }}
    >
      {icon}
      <span>{label}</span>
      <div
        className="ml-auto w-8 h-[18px] rounded-full relative transition-all duration-200"
        style={{ background: checked ? 'var(--accent)' : 'var(--text-tertiary)' }}
      >
        <div
          className="absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200"
          style={{
            background: checked ? 'var(--bg-primary)' : 'var(--bg-secondary)',
            left: checked ? '14px' : '2px',
          }}
        />
      </div>
    </button>
  );
}

// ─── Palette Selector ──────────────────────────────────────
function PaletteSelector({ selected, onSelect }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-secondary)' }}>
        PALETTE
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {PALETTE_KEYS.map((key) => {
          const p = PALETTES[key];
          const isActive = selected === key;
          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg text-center transition-all duration-150"
              style={{
                background: isActive ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                border: `1px solid ${isActive ? 'rgba(200,230,74,0.3)' : 'var(--border-subtle)'}`,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <span className="text-base leading-none">{p.icon}</span>
              <span className="text-[10px] font-semibold leading-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.name}</span>
              <span className="text-[9px] opacity-60 leading-none">{p.description}</span>
              {/* Color preview dots */}
              {p.colors && (
                <div className="flex gap-[2px] mt-1 flex-wrap justify-center max-h-3 overflow-hidden">
                  {p.colors.slice(0, 8).map((c, i) => (
                    <div
                      key={i}
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }}
                    />
                  ))}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────
export default function App() {
  const [image, setImage] = useState(null);
  const [imageName, setImageName] = useState('');
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [pixelSize, setPixelSize] = useState(8);
  const [paletteKey, setPaletteKey] = useState('original');
  const [dithering, setDithering] = useState(false);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const sourceCanvasRef = useRef(null);
  const outputCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const animFrameRef = useRef(null);

  // Load image onto hidden source canvas
  const loadImage = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImageName(file.name);
        setImageSize({ w: img.width, h: img.height });
        const canvas = sourceCanvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        setImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  // Process and render
  const render = useCallback(() => {
    if (!image || !outputCanvasRef.current || !sourceCanvasRef.current) return;

    const outCanvas = outputCanvasRef.current;
    outCanvas.width = sourceCanvasRef.current.width;
    outCanvas.height = sourceCanvasRef.current.height;
    const ctx = outCanvas.getContext('2d');

    const palette = PALETTES[paletteKey]?.colors || null;

    const { imageData } = processImage({
      sourceCanvas: sourceCanvasRef.current,
      pixelSize,
      palette,
      dithering,
      brightness,
      contrast,
    });

    ctx.putImageData(imageData, 0, 0);

    if (showGrid && pixelSize > 2) {
      drawGrid(ctx, outCanvas.width, outCanvas.height, pixelSize);
    }
  }, [image, pixelSize, paletteKey, dithering, brightness, contrast, showGrid]);

  // Re-render when params change (debounced via rAF)
  useEffect(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [render]);

  // File drop handlers
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) loadImage(file);
  }, [loadImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (file) loadImage(file);
  }, [loadImage]);

  // Export
  const handleExport = useCallback(() => {
    if (!outputCanvasRef.current) return;
    const link = document.createElement('a');
    const name = imageName ? imageName.replace(/\.[^.]+$/, '') : 'pixelforge';
    link.download = `${name}_${PALETTES[paletteKey].name.toLowerCase()}_${pixelSize}px.png`;
    link.href = outputCanvasRef.current.toDataURL('image/png');
    link.click();
  }, [imageName, paletteKey, pixelSize]);

  // Reset adjustments
  const handleReset = useCallback(() => {
    setPixelSize(8);
    setPaletteKey('original');
    setDithering(false);
    setBrightness(0);
    setContrast(0);
    setShowGrid(false);
  }, []);

  const pixelCount = image ? Math.ceil(imageSize.w / pixelSize) * Math.ceil(imageSize.h / pixelSize) : 0;

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* ─── Header ───────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              ⚒
            </div>
            <h1 className="text-sm font-semibold tracking-tight">PixelForge</h1>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
            v1.0
          </span>
        </div>
        {image && (
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <ResetIcon /> Reset
          </motion.button>
        )}
      </header>

      {/* ─── Main Content ─────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── Canvas Area (Left, 70%) ─────────── */}
        <div
          ref={containerRef}
          className="flex-[7] flex items-center justify-center p-4 relative"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <canvas ref={sourceCanvasRef} className="hidden" />

          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 cursor-pointer rounded-2xl p-12 w-full max-w-lg transition-all duration-200"
                style={{
                  background: isDragging ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: `2px dashed ${isDragging ? 'var(--accent)' : 'var(--border-hover)'}`,
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <motion.div
                  animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                  style={{ color: isDragging ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  <UploadIcon />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Drop an image here
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    or click to browse · JPG, PNG, GIF
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </motion.div>
            ) : (
              <motion.div
                key="canvas"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center w-full h-full"
              >
                <canvas
                  ref={outputCanvasRef}
                  className="max-w-full max-h-full rounded-lg"
                  style={{
                    imageRendering: 'pixelated',
                    boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Drop overlay */}
          <AnimatePresence>
            {isDragging && image && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-4 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(200,230,74,0.08)',
                  border: '2px dashed var(--accent)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
                  Drop to replace image
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Controls Sidebar (Right, 30%) ───── */}
        <motion.aside
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex-[3] min-w-[280px] max-w-[340px] overflow-y-auto p-4 flex flex-col gap-4"
          style={{
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-subtle)',
          }}
        >
          {/* Pixel Size */}
          <Slider
            label="PIXEL SIZE"
            value={pixelSize}
            onChange={setPixelSize}
            min={2}
            max={64}
            step={1}
            unit="px"
          />

          {/* Palette */}
          <PaletteSelector selected={paletteKey} onSelect={setPaletteKey} />

          {/* Toggles */}
          <div className="flex flex-col gap-2">
            <Toggle
              label="Dithering"
              icon={<DitheringIcon />}
              checked={dithering}
              onChange={setDithering}
            />
            <Toggle
              label="Grid overlay"
              icon={<GridIcon />}
              checked={showGrid}
              onChange={setShowGrid}
            />
          </div>

          {/* Brightness / Contrast */}
          <div className="flex flex-col gap-3 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <Slider label="BRIGHTNESS" value={brightness} onChange={setBrightness} min={-100} max={100} />
            <Slider label="CONTRAST" value={contrast} onChange={setContrast} min={-100} max={100} />
          </div>

          {/* Upload new / replace */}
          {image && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors mt-auto"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <UploadIcon /> Replace Image
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </motion.button>
          )}
        </motion.aside>
      </div>

      {/* ─── Bottom Bar ──────────────────────────── */}
      <footer
        className="flex items-center justify-between px-5 py-2.5 shrink-0"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-4">
          {image ? (
            <>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
                {imageSize.w} × {imageSize.h}
              </span>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
                {Math.ceil(imageSize.w / pixelSize)} × {Math.ceil(imageSize.h / pixelSize)} blocks
              </span>
              <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
                {pixelCount.toLocaleString()} pixels
              </span>
            </>
          ) : (
            <span className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-tertiary)' }}>
              No image loaded
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExport}
            disabled={!image}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              background: image ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: image ? 'var(--bg-primary)' : 'var(--text-tertiary)',
            }}
          >
            <DownloadIcon /> Export PNG
          </motion.button>
        </div>
      </footer>
    </div>
  );
}
