import { inspectImage } from "@/lib/ocr/image-preprocessing";
import { AppError } from "@/utils/errors";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function validateImageFile(file: File): Promise<void> {
  if (!ALLOWED_TYPES.includes(file.type) && !hasAllowedExtension(file.name)) {
    throw new AppError("Please choose a JPEG, PNG or WebP image.");
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new AppError("That image is larger than 15 MB. Please choose a smaller file.");
  }

  if (file.size < 8_000) {
    throw new AppError("That file is too small to be a readable bill photo.");
  }

  try {
    await inspectImage(file);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.message.startsWith("Please use")) {
      throw new AppError(error.message);
    }
    throw new AppError("This file could not be opened as an image.");
  }
}

function hasAllowedExtension(name: string): boolean {
  return /\.(jpe?g|png|webp)$/i.test(name);
}
