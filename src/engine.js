// PixelForge image processing engine
// Handles pixelation, color quantization, dithering, brightness/contrast

/**
 * Find nearest color in palette using Euclidean distance in RGB space
 */
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

/**
 * Apply brightness and contrast adjustments to pixel value
 */
function adjustBrightnessContrast(value, brightness, contrast) {
  // Brightness: -100 to 100
  let v = value + brightness * 2.55;
  // Contrast: -100 to 100
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  v = factor * (v - 128) + 128;
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Process the image: pixelate, apply palette quantization, optional dithering
 * Returns ImageData for the output canvas
 */
export function processImage({
  sourceCanvas,
  pixelSize,
  palette, // null for original, or array of [r,g,b]
  dithering,
  brightness,
  contrast,
}) {
  const sw = sourceCanvas.width;
  const sh = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  const sourceData = ctx.getImageData(0, 0, sw, sh);
  const src = sourceData.data;

  // Calculate output dimensions (in pixel blocks)
  const cols = Math.ceil(sw / pixelSize);
  const rows = Math.ceil(sh / pixelSize);

  // Step 1: Downsample — average each block
  const downsampled = new Float32Array(cols * rows * 3);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      const startY = row * pixelSize;
      const startX = col * pixelSize;
      const endY = Math.min(startY + pixelSize, sh);
      const endX = Math.min(startX + pixelSize, sw);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * sw + x) * 4;
          rSum += src[idx];
          gSum += src[idx + 1];
          bSum += src[idx + 2];
          count++;
        }
      }

      const di = (row * cols + col) * 3;
      downsampled[di] = rSum / count;
      downsampled[di + 1] = gSum / count;
      downsampled[di + 2] = bSum / count;
    }
  }

  // Step 2: Apply brightness/contrast
  if (brightness !== 0 || contrast !== 0) {
    for (let i = 0; i < downsampled.length; i++) {
      downsampled[i] = adjustBrightnessContrast(downsampled[i], brightness, contrast);
    }
  }

  // Step 3: Quantize with optional Floyd-Steinberg dithering
  const output = new Uint8ClampedArray(cols * rows * 3);

  if (palette && dithering) {
    // Floyd-Steinberg dithering
    const errors = new Float32Array(downsampled.length);
    for (let i = 0; i < downsampled.length; i++) errors[i] = downsampled[i];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const di = (row * cols + col) * 3;
        const oldR = Math.max(0, Math.min(255, errors[di]));
        const oldG = Math.max(0, Math.min(255, errors[di + 1]));
        const oldB = Math.max(0, Math.min(255, errors[di + 2]));

        const [newR, newG, newB] = findNearestColor(oldR, oldG, oldB, palette);
        output[di] = newR;
        output[di + 1] = newG;
        output[di + 2] = newB;

        const errR = oldR - newR;
        const errG = oldG - newG;
        const errB = oldB - newB;

        // Distribute error to neighbors
        const distribute = (c, r, factor) => {
          if (c >= 0 && c < cols && r >= 0 && r < rows) {
            const idx = (r * cols + c) * 3;
            errors[idx] += errR * factor;
            errors[idx + 1] += errG * factor;
            errors[idx + 2] += errB * factor;
          }
        };

        distribute(col + 1, row, 7 / 16);
        distribute(col - 1, row + 1, 3 / 16);
        distribute(col, row + 1, 5 / 16);
        distribute(col + 1, row + 1, 1 / 16);
      }
    }
  } else if (palette) {
    // Straight quantization
    for (let i = 0; i < cols * rows; i++) {
      const di = i * 3;
      const [r, g, b] = findNearestColor(
        downsampled[di], downsampled[di + 1], downsampled[di + 2], palette
      );
      output[di] = r;
      output[di + 1] = g;
      output[di + 2] = b;
    }
  } else {
    // Original — just clamp
    for (let i = 0; i < downsampled.length; i++) {
      output[i] = Math.max(0, Math.min(255, Math.round(downsampled[i])));
    }
  }

  // Step 4: Upscale back to original resolution
  const result = new ImageData(sw, sh);
  const dest = result.data;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const di = (row * cols + col) * 3;
      const r = output[di];
      const g = output[di + 1];
      const b = output[di + 2];

      const startY = row * pixelSize;
      const startX = col * pixelSize;
      const endY = Math.min(startY + pixelSize, sh);
      const endX = Math.min(startX + pixelSize, sw);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * sw + x) * 4;
          dest[idx] = r;
          dest[idx + 1] = g;
          dest[idx + 2] = b;
          dest[idx + 3] = 255;
        }
      }
    }
  }

  return { imageData: result, cols, rows };
}

/**
 * Draw grid overlay on a canvas
 */
export function drawGrid(ctx, width, height, pixelSize) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = pixelSize; x < width; x += pixelSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = pixelSize; y < height; y += pixelSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
}
