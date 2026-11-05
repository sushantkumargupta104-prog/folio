const MAX_DIMENSION = 2000;
const MIN_DIMENSION = 60;
const IDEAL_MIN_DIMENSION = 600;

export type PreprocessVariant = "standard" | "adaptive_binarize" | "handwritten";

export async function preprocessForOcr(
  source: Blob,
  variant: PreprocessVariant = "standard",
): Promise<Blob> {
  const bitmap = await createOrientedBitmap(source);

  // Resolution handling:
  // If image is very small (< 600px), upscale up to 2x to help OCR read small text.
  // If image is very large (> 2000px), downscale to protect mobile browser memory.
  let scale = 1.0;
  const maxDim = Math.max(bitmap.width, bitmap.height);
  const minDim = Math.min(bitmap.width, bitmap.height);

  if (maxDim > MAX_DIMENSION) {
    scale = MAX_DIMENSION / maxDim;
  } else if (minDim < IDEAL_MIN_DIMENSION && maxDim * 2 <= MAX_DIMENSION) {
    scale = Math.min(2.0, IDEAL_MIN_DIMENSION / minDim);
  }

  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Could not prepare the image for reading.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, width, height);
  const data = imageData.data;

  if (variant === "adaptive_binarize") {
    // Grayscale + local adaptive threshold (Bradley-Roth) for crumpled / shadowy receipts
    toGrayscale(data);
    adaptiveThreshold(data, width, height, 0.15, 0.12);
  } else if (variant === "handwritten") {
    // Grayscale + median noise smoothing + contrast boost for handwritten strokes
    toGrayscale(data);
    enhanceContrastPercentile(data, 0.03, 0.97);
    mildSharpen(data, width, height);
  } else {
    // Standard: Grayscale + contrast stretching + mild unsharp mask
    toGrayscale(data);
    enhanceContrastPercentile(data, 0.02, 0.98);
    mildSharpen(data, width, height);
  }

  context.putImageData(imageData, 0, 0);
  return await canvasToBlob(canvas, "image/png");
}

export async function inspectImage(source: Blob): Promise<{
  width: number;
  height: number;
}> {
  const bitmap = await createOrientedBitmap(source);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
    throw new Error("Please use a clearer photo. The image is too small to read.");
  }
  return size;
}

async function createOrientedBitmap(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(source);
  }
}

function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

/**
 * Contrast stretching using percentiles to eliminate outlier pixels (bright glare or black spots)
 */
function enhanceContrastPercentile(
  data: Uint8ClampedArray,
  lowPercentile = 0.02,
  highPercentile = 0.98,
): void {
  const histogram = new Uint32Array(256);
  const pixelCount = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i]]++;
  }

  let cumulative = 0;
  let minVal = 0;
  let maxVal = 255;
  const lowCutoff = pixelCount * lowPercentile;
  const highCutoff = pixelCount * highPercentile;

  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= lowCutoff && minVal === 0) {
      minVal = i;
    }
    if (cumulative >= highCutoff) {
      maxVal = i;
      break;
    }
  }

  const range = Math.max(1, maxVal - minVal);
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i];
    let stretched: number;
    if (v <= minVal) {
      stretched = 0;
    } else if (v >= maxVal) {
      stretched = 255;
    } else {
      stretched = Math.round(((v - minVal) / range) * 255);
    }

    // Apply gentle S-curve to darken dark text and brighten light background
    const finalVal =
      stretched < 128 ? (stretched * stretched) / 128 : 255 - ((255 - stretched) * (255 - stretched)) / 128;

    data[i] = finalVal;
    data[i + 1] = finalVal;
    data[i + 2] = finalVal;
  }
}

/**
 * Bradley-Roth adaptive thresholding using integral image.
 * Solves uneven lighting and shadows on crumpled receipts.
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  windowRatio = 0.15,
  tRatio = 0.12,
): void {
  const S = Math.max(8, Math.round(width * windowRatio));
  const s2 = Math.floor(S / 2);
  const integral = new Float64Array(width * height);

  // Compute integral image
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      sum += data[idx];
      if (y === 0) {
        integral[y * width + x] = sum;
      } else {
        integral[y * width + x] = integral[(y - 1) * width + x] + sum;
      }
    }
  }

  // Apply threshold
  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - s2);
    const y2 = Math.min(height - 1, y + s2);

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - s2);
      const x2 = Math.min(width - 1, x + s2);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const A = y1 > 0 && x1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0;
      const B = y1 > 0 ? integral[(y1 - 1) * width + x2] : 0;
      const C = x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0;
      const D = integral[y2 * width + x2];

      const sum = D - B - C + A;
      const mean = sum / count;

      const idx = (y * width + x) * 4;
      const pixel = data[idx];

      // If pixel is sufficiently darker than local neighborhood mean, it's text (0 = black), else 255 = white
      const val = pixel < mean * (1.0 - tRatio) ? 0 : 255;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}

/**
 * Mild 3x3 unsharp mask sharpening for blurry receipts.
 */
function mildSharpen(data: Uint8ClampedArray, width: number, height: number): void {
  // Kernel:
  // [  0, -0.25,   0 ]
  // [ -0.25, 2.0, -0.25 ]
  // [  0, -0.25,   0 ]
  const copy = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const center = copy[idx];
      const top = copy[((y - 1) * width + x) * 4];
      const bottom = copy[((y + 1) * width + x) * 4];
      const left = copy[(y * width + (x - 1)) * 4];
      const right = copy[(y * width + (x + 1)) * 4];

      const val = Math.min(255, Math.max(0, Math.round(2.0 * center - 0.25 * (top + bottom + left + right))));
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not prepare the image for reading."));
        return;
      }
      resolve(blob);
    }, type);
  });
}
