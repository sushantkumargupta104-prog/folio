import { getDatabase } from "@/lib/db/database";
import { findMatchingDatasetItem } from "@/lib/evaluation/ground-truth-dataset";
import type { ExpenseCategory } from "@/types/bill";
import type {
  CalculatedEvaluation,
  ComparisonResult,
  EvaluationGroundTruth,
  EvaluationSummary,
  FailureStage,
  ScanAttempt,
} from "@/types/evaluation";
import { AppError } from "@/utils/errors";
import { parseIsoDate } from "@/utils/format";
import { createId } from "@/utils/id";

export async function createScanAttempt(options: {
  imageFile: File | Blob;
  imageFileName?: string;
  groundTruth?: EvaluationGroundTruth;
}): Promise<ScanAttempt> {
  try {
    const now = new Date().toISOString();
    const id = createId();
    const fileName =
      options.imageFileName ||
      (options.imageFile instanceof File ? options.imageFile.name : `scan-${id.slice(0, 8)}.png`);
    const mimeType = options.imageFile.type || "image/png";
    const size = options.imageFile.size || 0;

    // Check if filename matches a standard test dataset item
    const matchedDataset = findMatchingDatasetItem(fileName);
    const gt = options.groundTruth ?? matchedDataset;

    const attempt: ScanAttempt = {
      id,
      imageId: `img-${id}`,
      imageBlob: options.imageFile,
      imageFileName: fileName,
      imageType: mimeType,
      imageSize: size,
      createdAt: now,
      updatedAt: now,
      processingStatus: "pending",

      predictedIsBill: null,
      billDetectionConfidence: null,
      billDetectionReasons: null,
      billDetectionWarnings: null,

      ocrStatus: "pending",
      ocrExtractedText: null,
      ocrConfidence: null,

      extractedMerchant: null,
      extractedDate: null,
      extractedAmount: null,
      extractedCategory: null,

      merchantConfidence: null,
      dateConfidence: null,
      amountConfidence: null,
      categoryConfidence: null,

      failureStage: null,
      failureReason: null,
      errorDetails: null,

      isSavedAsBill: false,
      savedBillId: null,

      expectedIsBill: gt?.expectedIsBill ?? null,
      expectedMerchant: gt?.expectedMerchant ?? null,
      expectedDate: gt?.expectedDate ?? null,
      expectedAmount: gt?.expectedAmount ?? null,
      expectedCategory: (gt?.expectedCategory as ExpenseCategory) ?? null,
      datasetTag: gt?.datasetTag ?? null,
      notes: gt?.notes ?? null,
    };

    await getDatabase().scanAttempts.add(attempt);
    return attempt;
  } catch (error) {
    console.error("Failed to persist initial scan attempt:", error);
    throw new AppError("Folio could not record the scan attempt.");
  }
}

export async function updateScanAttempt(
  id: string,
  updates: Partial<Omit<ScanAttempt, "id" | "createdAt">>,
): Promise<ScanAttempt | undefined> {
  try {
    const db = getDatabase();
    const existing = await db.scanAttempts.get(id);
    if (!existing) return undefined;

    const updated: ScanAttempt = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await db.scanAttempts.put(updated);
    return updated;
  } catch (error) {
    console.error("Failed to update scan attempt:", error);
    return undefined;
  }
}

export async function markAttemptFailed(
  id: string,
  stage: FailureStage,
  reason: string,
  errorDetails?: unknown,
): Promise<void> {
  const details =
    errorDetails instanceof Error
      ? errorDetails.stack || errorDetails.message
      : typeof errorDetails === "string"
        ? errorDetails
        : null;

  await updateScanAttempt(id, {
    processingStatus: "failed",
    failureStage: stage,
    failureReason: reason,
    errorDetails: details,
    ocrStatus: stage === "ocr" ? "failed" : undefined,
  });
}

export async function markAttemptCancelled(id: string): Promise<void> {
  await updateScanAttempt(id, {
    processingStatus: "cancelled",
    failureReason: "User cancelled scanning",
  });
}

export async function linkScanAttemptToSavedBill(
  attemptId: string | undefined,
  savedBillId: string,
): Promise<void> {
  if (!attemptId) return;
  await updateScanAttempt(attemptId, {
    isSavedAsBill: true,
    savedBillId,
  });
}

export async function getScanAttempts(): Promise<ScanAttempt[]> {
  try {
    return await getDatabase().scanAttempts.orderBy("createdAt").reverse().toArray();
  } catch (error) {
    console.error("Failed to load scan attempts:", error);
    return [];
  }
}

export async function getScanAttemptById(id: string): Promise<ScanAttempt | undefined> {
  try {
    return await getDatabase().scanAttempts.get(id);
  } catch {
    return undefined;
  }
}

export async function deleteScanAttempt(id: string): Promise<void> {
  try {
    await getDatabase().scanAttempts.delete(id);
  } catch (error) {
    console.error("Failed to delete scan attempt:", error);
    throw new AppError("Folio could not delete this evaluation record.");
  }
}

export async function deleteAllScanAttempts(): Promise<void> {
  try {
    await getDatabase().scanAttempts.clear();
  } catch (error) {
    console.error("Failed to clear scan attempts:", error);
    throw new AppError("Folio could not clear evaluation records.");
  }
}

export async function setAttemptGroundTruth(
  id: string,
  groundTruth: EvaluationGroundTruth,
): Promise<ScanAttempt | undefined> {
  return await updateScanAttempt(id, {
    expectedIsBill: groundTruth.expectedIsBill,
    expectedMerchant: groundTruth.expectedMerchant,
    expectedDate: groundTruth.expectedDate,
    expectedAmount: groundTruth.expectedAmount,
    expectedCategory: groundTruth.expectedCategory,
    datasetTag: groundTruth.datasetTag ?? null,
    notes: groundTruth.notes ?? null,
  });
}

// ----------------------------------------------------
// COMPARISON AND EVALUATION LOGIC
// ----------------------------------------------------

export function calculateEvaluation(attempt: ScanAttempt): CalculatedEvaluation {
  const hasGroundTruth = attempt.expectedIsBill !== null;

  if (!hasGroundTruth) {
    return {
      classification: "pending",
      merchant: "pending",
      date: "pending",
      amount: "pending",
      category: "pending",
      overall: "pending",
    };
  }

  // 1. Bill classification
  let classification: ComparisonResult;
  if (attempt.predictedIsBill === null) {
    classification = "pending";
  } else if (attempt.predictedIsBill === attempt.expectedIsBill) {
    classification = "correct";
  } else {
    classification = "incorrect";
  }

  // If this image is expected to be a NON-BILL:
  if (attempt.expectedIsBill === false) {
    // For non-bills, field extraction accuracy is not applicable unless ground truth specifically expects it
    const merchantResult =
      attempt.expectedMerchant != null
        ? compareMerchant(attempt.extractedMerchant, attempt.expectedMerchant)
        : "not_applicable";
    const dateResult =
      attempt.expectedDate != null
        ? compareDate(attempt.extractedDate, attempt.expectedDate)
        : "not_applicable";
    const amountResult =
      attempt.expectedAmount != null
        ? compareAmount(attempt.extractedAmount, attempt.expectedAmount)
        : "not_applicable";
    const categoryResult =
      attempt.expectedCategory != null
        ? compareCategory(attempt.extractedCategory, attempt.expectedCategory)
        : "not_applicable";

    const overall = classification === "correct" ? "passed" : "failed";

    return {
      classification,
      merchant: merchantResult,
      date: dateResult,
      amount: amountResult,
      category: categoryResult,
      overall,
    };
  }

  // GENUINE BILL:
  // If genuine bill was rejected or failed before extraction:
  // its extraction fields are marked as failed ("incorrect"), not silently excluded!
  const billRejected = attempt.predictedIsBill === false || attempt.failureStage === "detection";
  const ocrFailed = attempt.ocrStatus === "failed";

  const merchant: ComparisonResult =
    billRejected || ocrFailed || attempt.extractedMerchant === null
      ? attempt.expectedMerchant != null
        ? "incorrect"
        : "not_applicable"
      : compareMerchant(attempt.extractedMerchant, attempt.expectedMerchant);

  const date: ComparisonResult =
    billRejected || ocrFailed || attempt.extractedDate === null
      ? attempt.expectedDate != null
        ? "incorrect"
        : "not_applicable"
      : compareDate(attempt.extractedDate, attempt.expectedDate);

  const amount: ComparisonResult =
    billRejected || ocrFailed || attempt.extractedAmount === null
      ? attempt.expectedAmount != null
        ? "incorrect"
        : "not_applicable"
      : compareAmount(attempt.extractedAmount, attempt.expectedAmount);

  const category: ComparisonResult =
    billRejected || ocrFailed || attempt.extractedCategory === null
      ? attempt.expectedCategory != null
        ? "incorrect"
        : "not_applicable"
      : compareCategory(attempt.extractedCategory, attempt.expectedCategory);

  // Overall passes if classification is correct and all expected fields that exist are correct
  const allFieldsPassed =
    (merchant === "correct" || merchant === "not_applicable") &&
    (date === "correct" || date === "not_applicable") &&
    (amount === "correct" || amount === "not_applicable") &&
    (category === "correct" || category === "not_applicable");

  const overall = classification === "correct" && allFieldsPassed ? "passed" : "failed";

  return {
    classification,
    merchant,
    date,
    amount,
    category,
    overall,
  };
}

function normalizeString(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compareMerchant(
  predicted: string | null,
  expected: string | null,
): ComparisonResult {
  if (expected == null) return "not_applicable";
  if (!predicted) return "incorrect";

  const predNorm = normalizeString(predicted);
  const expNorm = normalizeString(expected);

  if (!predNorm || !expNorm) return "incorrect";

  // Exact match after normalization
  if (predNorm === expNorm) return "correct";

  // Substring match where one contains the full business name (e.g. "Starbucks Coffee" vs "Starbucks")
  if (predNorm.includes(expNorm) || expNorm.includes(predNorm)) {
    // Ensure it's not a trivial 1-2 char match
    if (Math.min(predNorm.length, expNorm.length) >= 4) {
      return "correct";
    }
  }

  // Levenshtein similarity for OCR character mistakes (e.g. "Decath1on" vs "Decathlon")
  const similarity = stringSimilarity(predNorm, expNorm);
  if (similarity >= 0.8) return "correct";

  return "incorrect";
}

export function compareDate(
  predicted: string | null,
  expected: string | null,
): ComparisonResult {
  if (expected == null) return "not_applicable";
  if (!predicted) return "incorrect";

  // Normalize both dates to YYYY-MM-DD
  const predParsed = parseIsoDate(predicted);
  const expParsed = parseIsoDate(expected);

  if (predParsed && expParsed) {
    return predParsed.toISOString().slice(0, 10) === expParsed.toISOString().slice(0, 10)
      ? "correct"
      : "incorrect";
  }

  return predicted.trim() === expected.trim() ? "correct" : "incorrect";
}

export function compareAmount(
  predicted: number | null,
  expected: number | null,
): ComparisonResult {
  if (expected == null) return "not_applicable";
  if (predicted == null || !Number.isFinite(predicted)) return "incorrect";

  // Numeric comparison within 0.05 currency tolerance (cents / paise rounding)
  const diff = Math.abs(predicted - expected);
  return diff < 0.05 ? "correct" : "incorrect";
}

export function compareCategory(
  predicted: ExpenseCategory | string | null,
  expected: ExpenseCategory | string | null,
): ComparisonResult {
  if (expected == null) return "not_applicable";
  if (!predicted) return "incorrect";

  return normalizeString(predicted) === normalizeString(expected) ? "correct" : "incorrect";
}

function stringSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  const distance = editDistance(longer, shorter);
  return (longerLength - distance) / longerLength;
}

function editDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

// ----------------------------------------------------
// SUMMARY METRICS CALCULATION
// ----------------------------------------------------

export function calculateEvaluationSummary(attempts: ScanAttempt[]): EvaluationSummary {
  let totalWithGroundTruth = 0;
  let correctClassifications = 0;
  let classificationEligibleCount = 0;

  let merchantCorrectCount = 0;
  let merchantEligibleCount = 0;

  let dateCorrectCount = 0;
  let dateEligibleCount = 0;

  let amountCorrectCount = 0;
  let amountEligibleCount = 0;

  let categoryCorrectCount = 0;
  let categoryEligibleCount = 0;

  let ocrFailureCount = 0;
  let billDetectionRejections = 0;

  for (const attempt of attempts) {
    if (attempt.ocrStatus === "failed" || attempt.failureStage === "ocr") {
      ocrFailureCount += 1;
    }
    if (attempt.predictedIsBill === false) {
      billDetectionRejections += 1;
    }

    if (attempt.expectedIsBill === null) continue;
    totalWithGroundTruth += 1;

    const evalResult = calculateEvaluation(attempt);

    // Classification
    classificationEligibleCount += 1;
    if (evalResult.classification === "correct") {
      correctClassifications += 1;
    }

    // Extractions: only count towards eligible denominator if field is applicable
    if (evalResult.merchant !== "not_applicable" && evalResult.merchant !== "pending") {
      merchantEligibleCount += 1;
      if (evalResult.merchant === "correct") merchantCorrectCount += 1;
    }

    if (evalResult.date !== "not_applicable" && evalResult.date !== "pending") {
      dateEligibleCount += 1;
      if (evalResult.date === "correct") dateCorrectCount += 1;
    }

    if (evalResult.amount !== "not_applicable" && evalResult.amount !== "pending") {
      amountEligibleCount += 1;
      if (evalResult.amount === "correct") amountCorrectCount += 1;
    }

    if (evalResult.category !== "not_applicable" && evalResult.category !== "pending") {
      categoryEligibleCount += 1;
      if (evalResult.category === "correct") categoryCorrectCount += 1;
    }
  }

  return {
    totalEvaluated: attempts.length,
    totalWithGroundTruth,
    correctClassifications,
    classificationAccuracy:
      classificationEligibleCount > 0
        ? Number(((correctClassifications / classificationEligibleCount) * 100).toFixed(1))
        : null,
    classificationEligibleCount,

    merchantCorrectCount,
    merchantEligibleCount,
    merchantAccuracy:
      merchantEligibleCount > 0
        ? Number(((merchantCorrectCount / merchantEligibleCount) * 100).toFixed(1))
        : null,

    dateCorrectCount,
    dateEligibleCount,
    dateAccuracy:
      dateEligibleCount > 0
        ? Number(((dateCorrectCount / dateEligibleCount) * 100).toFixed(1))
        : null,

    amountCorrectCount,
    amountEligibleCount,
    amountAccuracy:
      amountEligibleCount > 0
        ? Number(((amountCorrectCount / amountEligibleCount) * 100).toFixed(1))
        : null,

    categoryCorrectCount,
    categoryEligibleCount,
    categoryAccuracy:
      categoryEligibleCount > 0
        ? Number(((categoryCorrectCount / categoryEligibleCount) * 100).toFixed(1))
        : null,

    ocrFailureCount,
    billDetectionRejections,
  };
}

// ----------------------------------------------------
// CSV EXPORT GENERATOR
// ----------------------------------------------------

export function exportEvaluationCsv(attempts: ScanAttempt[]): string {
  const headers = [
    "attempt_id",
    "dataset_tag",
    "file_name",
    "image_type",
    "image_size_bytes",
    "created_at",
    "processing_status",
    "expected_is_bill",
    "predicted_is_bill",
    "bill_detection_confidence",
    "classification_correct",
    "ocr_status",
    "ocr_confidence",
    "expected_merchant",
    "extracted_merchant",
    "merchant_confidence",
    "merchant_correct",
    "expected_date",
    "extracted_date",
    "date_confidence",
    "date_correct",
    "expected_amount",
    "extracted_amount",
    "amount_confidence",
    "amount_correct",
    "expected_category",
    "extracted_category",
    "category_confidence",
    "category_correct",
    "overall_evaluation",
    "failure_stage",
    "failure_reason",
    "is_saved_as_bill",
    "saved_bill_id",
    "notes",
  ];

  const rows = attempts.map((attempt) => {
    const evalResult = calculateEvaluation(attempt);
    return [
      escapeCsv(attempt.id),
      escapeCsv(attempt.datasetTag ?? ""),
      escapeCsv(attempt.imageFileName),
      escapeCsv(attempt.imageType),
      attempt.imageSize,
      escapeCsv(attempt.createdAt),
      escapeCsv(attempt.processingStatus),
      attempt.expectedIsBill === null ? "" : attempt.expectedIsBill ? "true" : "false",
      attempt.predictedIsBill === null ? "" : attempt.predictedIsBill ? "true" : "false",
      attempt.billDetectionConfidence ?? "",
      escapeCsv(evalResult.classification),
      escapeCsv(attempt.ocrStatus),
      attempt.ocrConfidence ?? "",
      escapeCsv(attempt.expectedMerchant ?? ""),
      escapeCsv(attempt.extractedMerchant ?? ""),
      attempt.merchantConfidence ?? "",
      escapeCsv(evalResult.merchant),
      escapeCsv(attempt.expectedDate ?? ""),
      escapeCsv(attempt.extractedDate ?? ""),
      attempt.dateConfidence ?? "",
      escapeCsv(evalResult.date),
      attempt.expectedAmount ?? "",
      attempt.extractedAmount ?? "",
      attempt.amountConfidence ?? "",
      escapeCsv(evalResult.amount),
      escapeCsv(attempt.expectedCategory ?? ""),
      escapeCsv(attempt.extractedCategory ?? ""),
      attempt.categoryConfidence ?? "",
      escapeCsv(evalResult.category),
      escapeCsv(evalResult.overall),
      escapeCsv(attempt.failureStage ?? ""),
      escapeCsv(attempt.failureReason ?? ""),
      attempt.isSavedAsBill ? "true" : "false",
      escapeCsv(attempt.savedBillId ?? ""),
      escapeCsv(attempt.notes ?? ""),
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

function escapeCsv(value: string | number): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
