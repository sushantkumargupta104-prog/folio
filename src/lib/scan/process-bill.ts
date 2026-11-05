import { detectBill } from "@/lib/detection/bill-detection";
import { extractBillFields } from "@/lib/extraction";
import { preprocessForOcr } from "@/lib/ocr/image-preprocessing";
import { recognizeText } from "@/lib/ocr/text-recognition";
import { markAttemptFailed, updateScanAttempt } from "@/lib/db/evaluation-service";
import type { BillDetectionResult, ExtractionResult, OcrResult } from "@/types/bill";

export interface ProcessBillResult {
  ocr: OcrResult;
  detection: BillDetectionResult;
  extraction: ExtractionResult;
  attemptId?: string;
}

export interface ProcessBillOptions {
  attemptId?: string;
  onStatus?: (label: string, progress?: number) => void;
}

export async function processBillImage(
  originalImage: Blob,
  optionsOrStatus?: ProcessBillOptions | ((label: string, progress?: number) => void),
): Promise<ProcessBillResult> {
  const options: ProcessBillOptions =
    typeof optionsOrStatus === "function"
      ? { onStatus: optionsOrStatus }
      : optionsOrStatus ?? {};

  const { attemptId, onStatus } = options;

  // 1. PREPROCESSING
  let prepared: Blob;
  try {
    if (attemptId) {
      await updateScanAttempt(attemptId, { processingStatus: "preprocessing" });
    }
    onStatus?.("Preparing your image...");
    prepared = await preprocessForOcr(originalImage);
  } catch (prepError) {
    if (attemptId) {
      await markAttemptFailed(
        attemptId,
        "preprocessing",
        prepError instanceof Error ? prepError.message : "Preprocessing failed",
        prepError,
      );
    }
    throw prepError;
  }

  // 2. OCR RECOGNITION
  let ocr: OcrResult;
  try {
    if (attemptId) {
      await updateScanAttempt(attemptId, { processingStatus: "reading_ocr" });
    }
    onStatus?.("Reading text from bill...");
    ocr = await recognizeText(prepared, onStatus);

    if (attemptId) {
      await updateScanAttempt(attemptId, {
        ocrStatus: "success",
        ocrExtractedText: ocr.text,
        ocrConfidence: ocr.meanConfidence,
      });
    }
  } catch (ocrError) {
    if (attemptId) {
      const msg =
        ocrError instanceof Error ? ocrError.message : "OCR text recognition failed";
      await markAttemptFailed(attemptId, "ocr", msg, ocrError);
    }
    throw ocrError;
  }

  // 3. BILL DETECTION
  let detection: BillDetectionResult;
  try {
    if (attemptId) {
      await updateScanAttempt(attemptId, { processingStatus: "detecting" });
    }
    onStatus?.("Checking whether this is a bill...");
    detection = detectBill(ocr);

    if (attemptId) {
      await updateScanAttempt(attemptId, {
        predictedIsBill: detection.isBill,
        billDetectionConfidence: detection.confidence,
        billDetectionReasons: detection.reasons,
        billDetectionWarnings: detection.warnings,
      });
    }
  } catch (detError) {
    if (attemptId) {
      await markAttemptFailed(
        attemptId,
        "detection",
        detError instanceof Error ? detError.message : "Bill detection failed",
        detError,
      );
    }
    throw detError;
  }

  // 4. FIELD EXTRACTION
  let extraction: ExtractionResult;
  try {
    if (attemptId) {
      await updateScanAttempt(attemptId, { processingStatus: "extracting" });
    }
    onStatus?.("Extracting merchant, date and amount...");
    extraction = extractBillFields(ocr);

    if (attemptId) {
      const isRejected = detection.decision === "not_bill";
      await updateScanAttempt(attemptId, {
        processingStatus: "completed",
        extractedMerchant: extraction.merchantName.value,
        extractedDate: extraction.date.value,
        extractedAmount: extraction.totalAmount.value,
        extractedCategory: extraction.category.value,
        merchantConfidence: extraction.merchantName.confidence,
        dateConfidence: extraction.date.confidence,
        amountConfidence: extraction.totalAmount.confidence,
        categoryConfidence: extraction.category.confidence,
        failureStage: isRejected ? "detection" : null,
        failureReason: isRejected ? "Classified as non-bill" : null,
      });
    }
  } catch (extError) {
    if (attemptId) {
      await markAttemptFailed(
        attemptId,
        "extraction",
        extError instanceof Error ? extError.message : "Field extraction failed",
        extError,
      );
    }
    throw extError;
  }

  return { ocr, detection, extraction, attemptId };
}
