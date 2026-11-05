const MAX_DIMENSION = 1600;
const MIN_DIMENSION = 200;

export async function preprocessForOcr(source: Blob): Promise<Blob> {
  const bitmap = await createOrientedBitmap(source);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
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

  const image = context.getImageData(0, 0, width, height);
  contrastGrayscale(image.data);
  context.putImageData(image, 0, 0);

  const blob = await canvasToBlob(canvas, "image/png");
  return blob;
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

function contrastGrayscale(data: Uint8ClampedArray): void {
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    min = Math.min(min, gray);
    max = Math.max(max, gray);
  }

  const range = Math.max(1, max - min);
  for (let i = 0; i < data.length; i += 4) {
    const stretched = ((data[i] - min) / range) * 255;
    const value = stretched < 140 ? stretched * 0.85 : Math.min(255, stretched * 1.08);
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
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
