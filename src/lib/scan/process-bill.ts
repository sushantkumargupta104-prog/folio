import { detectBill } from "@/lib/detection/bill-detection";
import { extractBillFields } from "@/lib/extraction";
import { preprocessForOcr } from "@/lib/ocr/image-preprocessing";
import { recognizeText } from "@/lib/ocr/text-recognition";
import type { BillDetectionResult, ExtractionResult, OcrResult } from "@/types/bill";

export interface ProcessBillResult {
  ocr: OcrResult;
  detection: BillDetectionResult;
  extraction: ExtractionResult;
}

export async function processBillImage(
  originalImage: Blob,
  onStatus?: (label: string, progress?: number) => void,
): Promise<ProcessBillResult> {
  onStatus?.("Preparing your image");
  const prepared = await preprocessForOcr(originalImage);

  onStatus?.("Reading your bill");
  const ocr = await recognizeText(prepared, onStatus);

  onStatus?.("Checking whether this is a bill");
  const detection = detectBill(ocr);

  onStatus?.("Extracting merchant, date and amount...");
  const extraction = extractBillFields(ocr);

  return { ocr, detection, extraction };
}
