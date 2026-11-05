import type { OcrResult, OcrWord } from "@/types/bill";
import { describeOcrStatus, getOcrWorker, setOcrProgressHandler } from "@/lib/ocr/worker";
import { AppError } from "@/utils/errors";

export async function recognizeText(
  image: Blob,
  onStatus?: (label: string, progress?: number) => void,
): Promise<OcrResult> {
  setOcrProgressHandler((status, progress) => {
    if (!onStatus) return;
    const mapped = describeOcrStatus(status, progress);
    onStatus(mapped.label, mapped.progress);
  });

  const worker = await getOcrWorker();

  try {
    const result = await worker.recognize(image);
    const data = result.data as {
      text?: string;
      confidence?: number;
      words?: Array<{ text?: string; confidence?: number }>;
    };
    const words: OcrWord[] = (data.words ?? [])
      .map((word) => ({
        text: word.text?.trim() ?? "",
        confidence: typeof word.confidence === "number" ? word.confidence : 0,
      }))
      .filter((word) => word.text.length > 0);

    const text = (data.text ?? "").trim();
    if (!text) {
      throw new AppError(
        "No readable text was found. Try a clearer, well-lit photo of the bill.",
      );
    }

    const meanConfidence =
      typeof data.confidence === "number"
        ? data.confidence
        : words.length
          ? words.reduce((sum, word) => sum + word.confidence, 0) / words.length
          : 0;

    return { text, words, meanConfidence };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Folio could not read this image. Try another photo with the bill filling the frame.",
    );
  } finally {
    setOcrProgressHandler(undefined);
  }
}
