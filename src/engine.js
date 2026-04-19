// PixelForge image processing engine
// Handles pixelation, color quantization, dithering, filters, shapes, export

// ─── Color Utilities ───────────────────────────────────────

function findNearestColor(r, g, b, palette) {
  let minDist = Infinity;
  let nearest = palette[0];
  for (let i = 0; i < palette.length; i++) {
    const pr = palette[i][0], pg = palette[i][1], pb = palette[i][2];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < minDist) {
      minDist = dist;
      nearest = palette[i];
      if (dist === 0) break;
    }
  }
  return nearest;
}

function adjustBrightnessContrast(value, brightness, contrast) {
  let v = value + brightness * 2.55;
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  v = factor * (v - 128) + 128;
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// ─── Filters ───────────────────────────────────────────────

function applyBlur(data, cols, rows, radius) {
  if (radius <= 0) return data;
  const r = Math.ceil(radius);
  const temp = new Float32Array(data.length);
  // Horizontal pass
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sR = 0, sG = 0, sB = 0, cnt = 0;
      for (let dx = -r; dx <= r; dx++) {
        const c = col + dx;
        if (c >= 0 && c < cols) {
          const i = (row * cols + c) * 3;
          sR += data[i]; sG += data[i + 1]; sB += data[i + 2]; cnt++;
        }
      }
      const i = (row * cols + col) * 3;
      temp[i] = sR / cnt; temp[i + 1] = sG / cnt; temp[i + 2] = sB / cnt;
    }
  }
  // Vertical pass
  const result = new Float32Array(data.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sR = 0, sG = 0, sB = 0, cnt = 0;
      for (let dy = -r; dy <= r; dy++) {
        const rr = row + dy;
        if (rr >= 0 && rr < rows) {
          const i = (rr * cols + col) * 3;
          sR += temp[i]; sG += temp[i + 1]; sB += temp[i + 2]; cnt++;
        }
      }
      const i = (row * cols + col) * 3;
      result[i] = sR / cnt; result[i + 1] = sG / cnt; result[i + 2] = sB / cnt;
    }
  }
  return result;
}

function applySharpen(data, cols, rows, amount) {
  if (amount <= 0) return data;
  const factor = amount / 100;
  const blurred = applyBlur(data, cols, rows, 1);
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = Math.max(0, Math.min(255, data[i] + factor * 2 * (data[i] - blurred[i])));
  }
  return result;
}

function applyHueSaturation(data, cols, rows, hueRot, sat) {
  if (hueRot === 0 && sat === 0) return data;
  const result = new Float32Array(data.length);
  for (let i = 0; i < cols * rows; i++) {
    const idx = i * 3;
    let [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);
    if (hueRot !== 0) { h = (h + hueRot) % 360; if (h < 0) h += 360; }
    if (sat !== 0) s = Math.max(0, Math.min(100, s + sat));
    const [r, g, b] = hslToRgb(h, s, l);
    result[idx] = r; result[idx + 1] = g; result[idx + 2] = b;
  }
  return result;
}

function applyInvert(data) {
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) result[i] = 255 - data[i];
  return result;
}

function applySepia(data, cols, rows) {
  const result = new Float32Array(data.length);
  for (let i = 0; i < cols * rows; i++) {
    const idx = i * 3;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];
    result[idx] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    result[idx + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    result[idx + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
  }
  return result;
}

function applyGrayscale(data, cols, rows) {
  const result = new Float32Array(data.length);
  for (let i = 0; i < cols * rows; i++) {
    const idx = i * 3;
    const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    result[idx] = gray; result[idx + 1] = gray; result[idx + 2] = gray;
  }
  return result;
}

function applyPosterize(data, levels) {
  if (levels >= 256) return data;
  const result = new Float32Array(data.length);
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i++) {
    result[i] = Math.round(Math.round(data[i] / step) * step);
  }
  return result;
}

// ─── Edge Detection / Outline ───────────────────────────

function applyOutline(data, cols, rows, threshold, color = [0, 0, 0]) {
  // Sobel edge detection on luminance
  const lum = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    lum[i] = 0.299 * data[i * 3] + 0.587 * data[i * 3 + 1] + 0.114 * data[i * 3 + 2];
  }
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const gx =
        -lum[(y - 1) * cols + (x - 1)] + lum[(y - 1) * cols + (x + 1)] +
        -2 * lum[y * cols + (x - 1)] + 2 * lum[y * cols + (x + 1)] +
        -lum[(y + 1) * cols + (x - 1)] + lum[(y + 1) * cols + (x + 1)];
      const gy =
        -lum[(y - 1) * cols + (x - 1)] - 2 * lum[(y - 1) * cols + x] - lum[(y - 1) * cols + (x + 1)] +
        lum[(y + 1) * cols + (x - 1)] + 2 * lum[(y + 1) * cols + x] + lum[(y + 1) * cols + (x + 1)];
      const mag = Math.sqrt(gx * gx + gy * gy);
      if (mag > threshold) {
        const i = (y * cols + x) * 3;
        out[i] = color[0]; out[i + 1] = color[1]; out[i + 2] = color[2];
      }
    }
  }
  return out;
}

// ─── Dithering Matrices ──────────────────────────────────

// 8x8 Bayer matrix (normalized 0..1, then centered around 0)
const BAYER_8 = (() => {
  const m = [
    0, 32, 8, 40, 2, 34, 10, 42,
    48, 16, 56, 24, 50, 18, 58, 26,
    12, 44, 4, 36, 14, 46, 6, 38,
    60, 28, 52, 20, 62, 30, 54, 22,
    3, 35, 11, 43, 1, 33, 9, 41,
    51, 19, 59, 27, 49, 17, 57, 25,
    15, 47, 7, 39, 13, 45, 5, 37,
    63, 31, 55, 23, 61, 29, 53, 21,
  ];
  return m.map((v) => (v / 64 - 0.5) * 64); // strength ~±32
})();

// ─── Main Processing ───────────────────────────────────────

export function processImage({
  sourceCanvas, pixelSize, palette, dithering, brightness, contrast,
  sharpen = 0, blur = 0, hueRotation = 0, saturation = 0,
  invert = false, sepia = false, grayscale = false, posterize = 256,
  pixelShape = 'square', bgColor = null,
  outline = 0, outlineColor = [0, 0, 0],
}) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const sourceData = ctx.getImageData(0, 0, sw, sh);
  const src = sourceData.data;
  const cols = Math.ceil(sw / pixelSize);
  const rows = Math.ceil(sh / pixelSize);

  // 1. Downsample
  let downsampled = new Float32Array(cols * rows * 3);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      const sy = row * pixelSize, sx = col * pixelSize;
      const ey = Math.min(sy + pixelSize, sh), ex = Math.min(sx + pixelSize, sw);
      for (let y = sy; y < ey; y++) {
        for (let x = sx; x < ex; x++) {
          const i = (y * sw + x) * 4;
          rSum += src[i]; gSum += src[i + 1]; bSum += src[i + 2]; count++;
        }
      }
      const di = (row * cols + col) * 3;
      downsampled[di] = rSum / count;
      downsampled[di + 1] = gSum / count;
      downsampled[di + 2] = bSum / count;
    }
  }

  // 2. Brightness/contrast
  if (brightness !== 0 || contrast !== 0) {
    for (let i = 0; i < downsampled.length; i++) {
      downsampled[i] = adjustBrightnessContrast(downsampled[i], brightness, contrast);
    }
  }

  // 3. Filters (order matters)
  if (blur > 0) downsampled = applyBlur(downsampled, cols, rows, blur);
  if (sharpen > 0) downsampled = applySharpen(downsampled, cols, rows, sharpen);
  if (hueRotation !== 0 || saturation !== 0)
    downsampled = applyHueSaturation(downsampled, cols, rows, hueRotation, saturation);
  if (grayscale) downsampled = applyGrayscale(downsampled, cols, rows);
  if (sepia) downsampled = applySepia(downsampled, cols, rows);
  if (invert) downsampled = applyInvert(downsampled);
  if (posterize < 256) downsampled = applyPosterize(downsampled, posterize);
  if (outline > 0) downsampled = applyOutline(downsampled, cols, rows, outline, outlineColor);

  // 4. Quantize (supports: 'none'|false, 'floyd'|true, 'atkinson', 'bayer')
  const ditherMode = dithering === true ? 'floyd' : (dithering || 'none');
  const output = new Uint8ClampedArray(cols * rows * 3);
  if (palette && ditherMode === 'floyd') {
    const errors = new Float32Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) errors[i] = downsampled[i];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const di = (row * cols + col) * 3;
        const oR = Math.max(0, Math.min(255, errors[di]));
        const oG = Math.max(0, Math.min(255, errors[di + 1]));
        const oB = Math.max(0, Math.min(255, errors[di + 2]));
        const [nR, nG, nB] = findNearestColor(oR, oG, oB, palette);
        output[di] = nR; output[di + 1] = nG; output[di + 2] = nB;
        const eR = oR - nR, eG = oG - nG, eB = oB - nB;
        const dist = (c, r, f) => {
          if (c >= 0 && c < cols && r >= 0 && r < rows) {
            const i = (r * cols + c) * 3;
            errors[i] += eR * f; errors[i + 1] += eG * f; errors[i + 2] += eB * f;
          }
        };
        dist(col + 1, row, 7 / 16);
        dist(col - 1, row + 1, 3 / 16);
        dist(col, row + 1, 5 / 16);
        dist(col + 1, row + 1, 1 / 16);
      }
    }
  } else if (palette && ditherMode === 'atkinson') {
    const errors = new Float32Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) errors[i] = downsampled[i];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const di = (row * cols + col) * 3;
        const oR = Math.max(0, Math.min(255, errors[di]));
        const oG = Math.max(0, Math.min(255, errors[di + 1]));
        const oB = Math.max(0, Math.min(255, errors[di + 2]));
        const [nR, nG, nB] = findNearestColor(oR, oG, oB, palette);
        output[di] = nR; output[di + 1] = nG; output[di + 2] = nB;
        const eR = (oR - nR) / 8, eG = (oG - nG) / 8, eB = (oB - nB) / 8;
        const offsets = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
        for (const [dx, dy] of offsets) {
          const c = col + dx, r = row + dy;
          if (c >= 0 && c < cols && r >= 0 && r < rows) {
            const i = (r * cols + c) * 3;
            errors[i] += eR; errors[i + 1] += eG; errors[i + 2] += eB;
          }
        }
      }
    }
  } else if (palette && ditherMode === 'bayer') {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const di = (row * cols + col) * 3;
        const threshold = BAYER_8[(row & 7) * 8 + (col & 7)];
        const oR = Math.max(0, Math.min(255, downsampled[di] + threshold));
        const oG = Math.max(0, Math.min(255, downsampled[di + 1] + threshold));
        const oB = Math.max(0, Math.min(255, downsampled[di + 2] + threshold));
        const [nR, nG, nB] = findNearestColor(oR, oG, oB, palette);
        output[di] = nR; output[di + 1] = nG; output[di + 2] = nB;
      }
    }
  } else if (palette) {
    for (let i = 0; i < cols * rows; i++) {
      const di = i * 3;
      const [r, g, b] = findNearestColor(downsampled[di], downsampled[di + 1], downsampled[di + 2], palette);
      output[di] = r; output[di + 1] = g; output[di + 2] = b;
    }
  } else {
    for (let i = 0; i < downsampled.length; i++) {
      output[i] = Math.max(0, Math.min(255, Math.round(downsampled[i])));
    }
  }

  // 5. Upscale with shape
  const result = new ImageData(sw, sh);
  const dest = result.data;

  // Fill background
  if (bgColor) {
    for (let i = 0; i < dest.length; i += 4) {
      dest[i] = bgColor[0]; dest[i + 1] = bgColor[1]; dest[i + 2] = bgColor[2]; dest[i + 3] = 255;
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const di = (row * cols + col) * 3;
      const r = output[di], g = output[di + 1], b = output[di + 2];
      const sy = row * pixelSize, sx = col * pixelSize;
      const ey = Math.min(sy + pixelSize, sh), ex = Math.min(sx + pixelSize, sw);
      const cx = (sx + ex) / 2, cy = (sy + ey) / 2;
      const half = pixelSize / 2;

      for (let y = sy; y < ey; y++) {
        for (let x = sx; x < ex; x++) {
          let draw = true;
          if (pixelShape === 'circle') {
            const dx = x - cx + 0.5, dy = y - cy + 0.5;
            draw = (dx * dx + dy * dy) <= half * half;
          } else if (pixelShape === 'diamond') {
            draw = (Math.abs(x - cx + 0.5) + Math.abs(y - cy + 0.5)) <= half;
          }
          if (draw) {
            const i = (y * sw + x) * 4;
            dest[i] = r; dest[i + 1] = g; dest[i + 2] = b; dest[i + 3] = 255;
          }
        }
      }
    }
  }

  return { imageData: result, cols, rows, output };
}

// ─── Grid ──────────────────────────────────────────────────

export function drawGrid(ctx, width, height, pixelSize) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = pixelSize; x < width; x += pixelSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = pixelSize; y < height; y += pixelSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
}

// ─── Analytics ─────────────────────────────────────────────

export function countUniqueColors(output, count) {
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    seen.add((output[idx] << 16) | (output[idx + 1] << 8) | output[idx + 2]);
  }
  return seen.size;
}

export function computeHistogram(output, count) {
  const rH = new Uint32Array(256), gH = new Uint32Array(256), bH = new Uint32Array(256);
  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    rH[output[idx]]++; gH[output[idx + 1]]++; bH[output[idx + 2]]++;
  }
  return { r: rH, g: gH, b: bH };
}

// ─── Export Helpers ────────────────────────────────────────

export function exportSVG(output, cols, rows, pixelSize) {
  const w = cols * pixelSize, h = rows * pixelSize;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n`;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 3;
      svg += `<rect x="${col * pixelSize}" y="${row * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="rgb(${output[i]},${output[i + 1]},${output[i + 2]})"/>\n`;
    }
  }
  return svg + '</svg>';
}

export function createScaledCanvas(outputCanvas, scale) {
  const c = document.createElement('canvas');
  c.width = outputCanvas.width * scale;
  c.height = outputCanvas.height * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(outputCanvas, 0, 0, c.width, c.height);
  return c;
}

// ─── Palette Extraction (k-means on downsampled image) ─────
export function extractPalette(sourceCanvas, k = 16, maxSamples = 4000) {
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = sourceCanvas;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Random sample of pixels
  const samples = [];
  const stride = Math.max(1, Math.floor((w * h) / maxSamples));
  for (let i = 0; i < w * h; i += stride) {
    const p = i * 4;
    samples.push([data[p], data[p + 1], data[p + 2]]);
  }
  if (samples.length === 0) return [[0, 0, 0]];

  // k-means init: spaced samples
  const centroids = [];
  const step = Math.max(1, Math.floor(samples.length / k));
  for (let i = 0; i < k; i++) centroids.push([...samples[(i * step) % samples.length]]);

  const labels = new Int32Array(samples.length);
  for (let iter = 0; iter < 10; iter++) {
    // Assign
    for (let s = 0; s < samples.length; s++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = (samples[s][0] - centroids[c][0]) ** 2 +
                  (samples[s][1] - centroids[c][1]) ** 2 +
                  (samples[s][2] - centroids[c][2]) ** 2;
        if (d < bestD) { bestD = d; best = c; }
      }
      labels[s] = best;
    }
    // Update
    const sums = Array.from({ length: centroids.length }, () => [0, 0, 0, 0]);
    for (let s = 0; s < samples.length; s++) {
      const l = labels[s];
      sums[l][0] += samples[s][0];
      sums[l][1] += samples[s][1];
      sums[l][2] += samples[s][2];
      sums[l][3]++;
    }
    for (let c = 0; c < centroids.length; c++) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          Math.round(sums[c][0] / sums[c][3]),
          Math.round(sums[c][1] / sums[c][3]),
          Math.round(sums[c][2] / sums[c][3]),
        ];
      }
    }
  }

  // Sort by brightness for a nice ramp
  centroids.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  return centroids;
}

// ─── Animated GIF Export (using gif.js via dynamic import) ─
export async function exportAnimatedGIF(frames, fps = 12) {
  // frames: array of canvas (already sized)
  if (frames.length === 0) return null;
  const w = frames[0].width, h = frames[0].height;
  // Use browser's HTMLCanvasElement → blob
  // Simple APNG-ish fallback: return first frame as PNG blob.
  // For true GIF we dynamic-import gif.js (added as dep).
  const { default: GIF } = await import('gif.js');
  return new Promise((resolve) => {
    const gif = new GIF({
      workers: 2, quality: 10, width: w, height: h,
      workerScript: new URL('gif.js/dist/gif.worker.js', import.meta.url).toString(),
    });
    for (const frame of frames) gif.addFrame(frame, { delay: Math.round(1000 / fps) });
    gif.on('finished', (blob) => resolve(blob));
    gif.render();
  });
}
