import type { OcrResult, OcrWord } from "@/types/bill";
import { describeOcrStatus, getOcrWorker, resetOcrWorker, setOcrProgressHandler } from "@/lib/ocr/worker";
import { preprocessForOcr } from "@/lib/ocr/image-preprocessing";
import { AppError } from "@/utils/errors";

export async function recognizeText(
  image: Blob,
  onStatus?: (label: string, progress?: number) => void,
  attemptFallback = true,
): Promise<OcrResult> {
  setOcrProgressHandler((status, progress) => {
    if (!onStatus) return;
    const mapped = describeOcrStatus(status, progress);
    onStatus(mapped.label, mapped.progress);
  });

  try {
    const worker = await getOcrWorker();
    const result = await worker.recognize(image);
    const parsed = parseTesseractOutput(result.data);

    // If first pass produced virtually no text and fallback is allowed,
    // attempt a secondary pass using adaptive binarization (great for crumpled/shadowed paper)
    if (attemptFallback && (parsed.words.length < 5 || parsed.meanConfidence < 35)) {
      onStatus?.("Retrying with adaptive binarization for better clarity...");
      try {
        const fallbackImage = await preprocessForOcr(image, "adaptive_binarize");
        const fallbackResult = await worker.recognize(fallbackImage);
        const fallbackParsed = parseTesseractOutput(fallbackResult.data);

        // Keep fallback if it produced more words or higher confidence
        if (
          fallbackParsed.words.length > parsed.words.length ||
          (fallbackParsed.words.length >= 5 && fallbackParsed.meanConfidence > parsed.meanConfidence)
        ) {
          return fallbackParsed;
        }
      } catch (fallbackError) {
        console.warn("Secondary OCR preprocessing pass failed:", fallbackError);
      }
    }

    if (!parsed.text) {
      throw new AppError(
        "No readable text was found. Try a clearer, well-lit photo of the bill.",
      );
    }

    return parsed;
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Reset worker in case of a crash
    resetOcrWorker();
    throw new AppError(
      "Folio could not read this image. Try another photo with the bill filling the frame.",
    );
  } finally {
    setOcrProgressHandler(undefined);
  }
}

interface TesseractData {
  text?: string;
  confidence?: number;
  words?: Array<{
    text?: string;
    confidence?: number;
    bbox?: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

function parseTesseractOutput(data: unknown): OcrResult {
  const d = (data ?? {}) as TesseractData;
  const words: OcrWord[] = (d.words ?? [])
    .map((word) => ({
      text: word.text?.trim() ?? "",
      confidence: typeof word.confidence === "number" ? Math.round(word.confidence) : 0,
      bbox: word.bbox,
    }))
    .filter((word) => word.text.length > 0);

  const text = (d.text ?? "").trim();
  const meanConfidence =
    typeof d.confidence === "number" && Number.isFinite(d.confidence)
      ? Math.round(d.confidence)
      : words.length
        ? Math.round(words.reduce((sum, word) => sum + word.confidence, 0) / words.length)
        : 0;

  return { text, words, meanConfidence };
}
