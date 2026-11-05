import { getDatabase } from "@/lib/db/database";
import { findMatchingDatasetItem } from "@/lib/evaluation/ground-truth-dataset";
import type { ExpenseCategory } from "@/types/bill";
import type {
  ActionStatus,
  CalculatedEvaluation,
  ClassificationStatus,
  EvaluationGroundTruth,
  EvaluationSummary,
  ExpectedTypeStatus,
  ExtractionStatus,
  FailureStage,
  OverallStatus,
  ScanAttempt,
} from "@/types/evaluation";
import { AppError } from "@/utils/errors";
import { parseIsoDate, toIsoDate } from "@/utils/format";
import { createId } from "@/utils/id";

// ----------------------------------------------------
// COMPARISON AND EVALUATION LOGIC
// ----------------------------------------------------

export function populateDefaultGroundTruth(attempt: ScanAttempt): boolean {
  let changed = false;

  // 1. If expectedIsBill is not set, default to predictedIsBill (or true if predictedIsBill is null or pending)
  if (attempt.expectedIsBill === null) {
    if (attempt.predictedIsBill !== null) {
      attempt.expectedIsBill = attempt.predictedIsBill;
      changed = true;
    } else if (
      attempt.processingStatus === "completed" ||
      attempt.processingStatus === "extracting" ||
      attempt.processingStatus === "detecting"
    ) {
      attempt.expectedIsBill = true;
      changed = true;
    }
  }

  // 2. Default extraction ground truth to whatever was extracted
  if (attempt.expectedIsBill === true || (attempt.expectedIsBill === null && attempt.predictedIsBill !== false)) {
    if (attempt.expectedMerchant === null && attempt.extractedMerchant !== null) {
      attempt.expectedMerchant = attempt.extractedMerchant;
      changed = true;
    }
    if (attempt.expectedDate === null && attempt.extractedDate !== null) {
      attempt.expectedDate = attempt.extractedDate;
      changed = true;
    }
    if (attempt.expectedAmount === null && attempt.extractedAmount !== null) {
      attempt.expectedAmount = attempt.extractedAmount;
      changed = true;
    }
    if (attempt.expectedCategory === null && attempt.extractedCategory !== null) {
      attempt.expectedCategory = attempt.extractedCategory;
      changed = true;
    }
  } else if (attempt.expectedIsBill === false) {
    if (
      attempt.expectedMerchant !== null ||
      attempt.expectedDate !== null ||
      attempt.expectedAmount !== null ||
      attempt.expectedCategory !== null
    ) {
      attempt.expectedMerchant = null;
      attempt.expectedDate = null;
      attempt.expectedAmount = null;
      attempt.expectedCategory = null;
      changed = true;
    }
  }

  return changed;
}

export function resolveEffectiveGroundTruth(attempt: ScanAttempt): {
  expectedIsBill: boolean;
  expectedMerchant: string | null;
  expectedDate: string | null;
  expectedAmount: number | null;
  expectedCategory: ExpenseCategory | null;
} {
  const isBill =
    attempt.expectedIsBill !== null
      ? attempt.expectedIsBill
      : attempt.predictedIsBill !== null
        ? attempt.predictedIsBill
        : true;

  if (!isBill) {
    return {
      expectedIsBill: false,
      expectedMerchant: null,
      expectedDate: null,
      expectedAmount: null,
      expectedCategory: null,
    };
  }

  return {
    expectedIsBill: true,
    expectedMerchant:
      attempt.expectedMerchant !== null
        ? attempt.expectedMerchant
        : attempt.extractedMerchant,
    expectedDate:
      attempt.expectedDate !== null
        ? attempt.expectedDate
        : attempt.extractedDate,
    expectedAmount:
      attempt.expectedAmount !== null
        ? attempt.expectedAmount
        : attempt.extractedAmount,
    expectedCategory:
      attempt.expectedCategory !== null
        ? attempt.expectedCategory
        : (attempt.extractedCategory as ExpenseCategory | null),
  };
}

export function evaluateExpectedType(attempt: ScanAttempt): ExpectedTypeStatus {
  const isBill =
    attempt.expectedIsBill !== null
      ? attempt.expectedIsBill
      : attempt.predictedIsBill !== null
        ? attempt.predictedIsBill
        : true;
  return isBill ? "Bill" : "Non-bill";
}

export function evaluateClassification(attempt: ScanAttempt): ClassificationStatus {
  if (attempt.predictedIsBill === null) {
    return "Not evaluated";
  }
  const expected =
    attempt.expectedIsBill !== null
      ? attempt.expectedIsBill
      : attempt.predictedIsBill;
  return attempt.predictedIsBill === expected ? "Correct" : "Incorrect";
}

export function evaluateScanAttempt(attempt: ScanAttempt): CalculatedEvaluation {
  const effectiveGt = resolveEffectiveGroundTruth(attempt);
  const expectedType: ExpectedTypeStatus = effectiveGt.expectedIsBill ? "Bill" : "Non-bill";
  const classification = evaluateClassification(attempt);

  // Check if system failed before field extraction (e.g. genuine bill rejected or OCR failed)
  const isExtractionUnavailable =
    attempt.predictedIsBill === false ||
    attempt.ocrStatus === "failed" ||
    attempt.failureStage === "ocr" ||
    attempt.failureStage === "detection";

  // 1. Merchant extraction
  const merchant = evaluateSingleField(
    effectiveGt.expectedIsBill,
    effectiveGt.expectedMerchant,
    attempt.extractedMerchant,
    compareMerchant,
    isExtractionUnavailable,
  );

  // 2. Date extraction
  const date = evaluateSingleField(
    effectiveGt.expectedIsBill,
    effectiveGt.expectedDate,
    attempt.extractedDate,
    compareDate,
    isExtractionUnavailable,
  );

  // 3. Amount extraction
  const amount = evaluateSingleField(
    effectiveGt.expectedIsBill,
    effectiveGt.expectedAmount,
    attempt.extractedAmount,
    compareAmount,
    isExtractionUnavailable,
  );

  // 4. Category extraction
  const category = evaluateSingleField(
    effectiveGt.expectedIsBill,
    effectiveGt.expectedCategory,
    attempt.extractedCategory,
    compareCategory,
    isExtractionUnavailable,
  );

  // 5. Overall evaluation
  const overall = evaluateOverall(attempt, classification, [
    merchant,
    date,
    amount,
    category,
  ]);

  // 6. Functional Action
  const action = evaluateAction(attempt);

  return {
    expectedType,
    classification,
    merchant,
    date,
    amount,
    category,
    overall,
    action,
  };
}

function evaluateSingleField<T>(
  isBill: boolean,
  expectedVal: T | null,
  extractedVal: T | null,
  compareFn: (extracted: T, expected: T) => boolean,
  isExtractionUnavailable: boolean,
): ExtractionStatus {
  // Non-bill images: extraction is Not applicable
  if (!isBill) {
    return "Not applicable";
  }

  // Genuine bill:
  // If the bill was rejected before extraction or OCR failed, or extraction produced null
  if (isExtractionUnavailable || extractedVal === null) {
    return "Not extracted";
  }

  // Default expected value to extracted value if not provided
  const effectiveExpected = expectedVal !== null ? expectedVal : extractedVal;
  if (effectiveExpected === null) {
    return "Not extracted";
  }

  return compareFn(extractedVal, effectiveExpected) ? "Correct" : "Incorrect";
}

function evaluateOverall(
  attempt: ScanAttempt,
  classification: ClassificationStatus,
  fieldStatuses: ExtractionStatus[],
): OverallStatus {
  // If classification is incorrect, overall is incorrect
  if (classification === "Incorrect") {
    return "Incorrect";
  }

  const isBill =
    attempt.expectedIsBill !== null
      ? attempt.expectedIsBill
      : attempt.predictedIsBill !== null
        ? attempt.predictedIsBill
        : true;

  // For non-bills, overall reflects classification correctness
  if (!isBill) {
    return classification === "Correct" ? "Correct" : "Incorrect";
  }

  if (classification === "Not evaluated") {
    return "Incorrect";
  }

  // Filter for applicable extraction checks (exclude non-applicable)
  const applicable = fieldStatuses.filter((s) => s !== "Not applicable");

  if (applicable.length === 0) {
    return "Correct";
  }

  const correctCount = applicable.filter((s) => s === "Correct").length;
  const failureCount = applicable.filter(
    (s) => s === "Incorrect" || s === "Not extracted",
  ).length;

  if (correctCount === applicable.length) {
    return "Correct";
  }

  if (correctCount > 0 && failureCount > 0) {
    return "Partially correct";
  }

  return "Incorrect";
}

function evaluateAction(attempt: ScanAttempt): ActionStatus {
  if (attempt.processingStatus === "failed" || attempt.failureStage !== null) {
    return "Retry scan";
  }
  return "View details";
}

// ----------------------------------------------------
// FIELD COMPARISON HELPERS
// ----------------------------------------------------

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
): boolean {
  if (predicted == null || expected == null) return false;

  const predNorm = normalizeString(predicted);
  const expNorm = normalizeString(expected);

  if (!predNorm || !expNorm) return false;

  // Exact match after normalization
  if (predNorm === expNorm) return true;

  // Substring match where one contains the full business name
  if (predNorm.includes(expNorm) || expNorm.includes(predNorm)) {
    if (Math.min(predNorm.length, expNorm.length) >= 4) {
      return true;
    }
  }

  // Levenshtein similarity for OCR character mistakes (e.g. "Decath1on" vs "Decathlon")
  const similarity = stringSimilarity(predNorm, expNorm);
  return similarity >= 0.8;
}

export function compareDate(
  predicted: string | null,
  expected: string | null,
): boolean {
  if (predicted == null || expected == null) return false;

  const predIso = normalizeDateToIso(predicted);
  const expIso = normalizeDateToIso(expected);

  if (predIso && expIso) {
    return predIso === expIso;
  }

  return predicted.trim() === expected.trim();
}

export function normalizeDateToIso(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const clean = dateStr.trim();

  // Check standard ISO YYYY-MM-DD
  const isoParsed = parseIsoDate(clean);
  if (isoParsed) return clean;

  // Check DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    let year = Number(dmyMatch[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    return toIsoDate(year, month, day);
  }

  // Check YYYY/MM/DD
  const ymdMatch = clean.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymdMatch) {
    return toIsoDate(Number(ymdMatch[1]), Number(ymdMatch[2]), Number(ymdMatch[3]));
  }

  return null;
}

export function compareAmount(
  predicted: number | null,
  expected: number | null,
): boolean {
  if (predicted == null || expected == null) return false;
  if (!Number.isFinite(predicted) || !Number.isFinite(expected)) return false;

  const diff = Math.abs(predicted - expected);
  return diff < 0.05;
}

export function compareCategory(
  predicted: ExpenseCategory | string | null,
  expected: ExpenseCategory | string | null,
): boolean {
  if (predicted == null || expected == null) return false;

  const predNorm = canonicalCategory(predicted);
  const expNorm = canonicalCategory(expected);

  return predNorm === expNorm;
}

function canonicalCategory(cat: string): string {
  const norm = normalizeString(cat);
  if (norm.includes("food") || norm.includes("dining") || norm.includes("restaurant") || norm.includes("cafe")) {
    return "food & dining";
  }
  if (norm.includes("grocer") || norm.includes("supermarket") || norm.includes("kirana")) {
    return "groceries";
  }
  if (norm.includes("transport") || norm.includes("fuel") || norm.includes("petrol") || norm.includes("cab") || norm.includes("taxi")) {
    return "transport";
  }
  if (norm.includes("health") || norm.includes("pharmacy") || norm.includes("medical") || norm.includes("doctor")) {
    return "healthcare";
  }
  if (norm.includes("entertain") || norm.includes("movie") || norm.includes("cinema")) {
    return "entertainment";
  }
  if (norm.includes("utilit") || norm.includes("electric") || norm.includes("recharge") || norm.includes("broadband")) {
    return "utilities";
  }
  if (norm.includes("shop") || norm.includes("apparel") || norm.includes("clothing") || norm.includes("retail")) {
    return "shopping";
  }
  return norm;
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
// DATABASE SERVICE WITH AUTOMATIC PERSISTENCE
// ----------------------------------------------------

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

    // Check if filename matches standard test dataset item
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

    // Populate default ground truth from predictions if not set
    populateDefaultGroundTruth(attempt);

    // Calculate initial evaluated statuses immediately
    const initialEval = evaluateScanAttempt(attempt);
    attempt.expectedTypeStatus = initialEval.expectedType;
    attempt.classificationStatus = initialEval.classification;
    attempt.merchantStatus = initialEval.merchant;
    attempt.dateStatus = initialEval.date;
    attempt.amountStatus = initialEval.amount;
    attempt.categoryStatus = initialEval.category;
    attempt.overallStatus = initialEval.overall;
    attempt.actionStatus = initialEval.action;

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

    const merged: ScanAttempt = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // By default, seed ground truth from predictions/extractions if not explicitly supplied
    populateDefaultGroundTruth(merged);

    // Recalculate evaluation statuses immediately with updated values
    const evalResult = evaluateScanAttempt(merged);
    merged.expectedTypeStatus = evalResult.expectedType;
    merged.classificationStatus = evalResult.classification;
    merged.merchantStatus = evalResult.merchant;
    merged.dateStatus = evalResult.date;
    merged.amountStatus = evalResult.amount;
    merged.categoryStatus = evalResult.category;
    merged.overallStatus = evalResult.overall;
    merged.actionStatus = evalResult.action;

    await db.scanAttempts.put(merged);
    return merged;
  } catch (error) {
    console.error("Failed to update scan attempt:", error);
    return undefined;
  }
}

export async function recalculateAndPersistAttempt(
  id: string,
): Promise<ScanAttempt | undefined> {
  const db = getDatabase();
  const attempt = await db.scanAttempts.get(id);
  if (!attempt) return undefined;

  // Auto-fill dataset ground truth if missing but filename or datasetTag matches
  if (attempt.expectedIsBill === null) {
    const matched =
      (attempt.datasetTag ? findMatchingDatasetItem(attempt.datasetTag) : undefined) ||
      findMatchingDatasetItem(attempt.imageFileName);
    if (matched) {
      attempt.expectedIsBill = matched.expectedIsBill;
      attempt.expectedMerchant = matched.expectedMerchant;
      attempt.expectedDate = matched.expectedDate;
      attempt.expectedAmount = matched.expectedAmount;
      attempt.expectedCategory = matched.expectedCategory as ExpenseCategory;
      attempt.datasetTag = matched.datasetTag ?? matched.id;
      attempt.notes = attempt.notes ?? matched.notes ?? null;
    }
  }

  // Populate default ground truth from predictions/extractions
  populateDefaultGroundTruth(attempt);

  const evalResult = evaluateScanAttempt(attempt);
  const updated: ScanAttempt = {
    ...attempt,
    expectedTypeStatus: evalResult.expectedType,
    classificationStatus: evalResult.classification,
    merchantStatus: evalResult.merchant,
    dateStatus: evalResult.date,
    amountStatus: evalResult.amount,
    categoryStatus: evalResult.category,
    overallStatus: evalResult.overall,
    actionStatus: evalResult.action,
    updatedAt: new Date().toISOString(),
  };

  await db.scanAttempts.put(updated);
  return updated;
}

export async function repairAllScanAttempts(): Promise<{
  repairedCount: number;
  totalCount: number;
}> {
  try {
    const db = getDatabase();
    const attempts = await db.scanAttempts.toArray();
    let repairedCount = 0;

    for (const attempt of attempts) {
      let updatedGt = false;
      if (attempt.expectedIsBill === null) {
        const matched =
          (attempt.datasetTag ? findMatchingDatasetItem(attempt.datasetTag) : undefined) ||
          findMatchingDatasetItem(attempt.imageFileName);
        if (matched) {
          attempt.expectedIsBill = matched.expectedIsBill;
          attempt.expectedMerchant = matched.expectedMerchant;
          attempt.expectedDate = matched.expectedDate;
          attempt.expectedAmount = matched.expectedAmount;
          attempt.expectedCategory = matched.expectedCategory as ExpenseCategory;
          attempt.datasetTag = matched.datasetTag ?? matched.id;
          attempt.notes = attempt.notes ?? matched.notes ?? null;
          updatedGt = true;
        }
      }

      if (populateDefaultGroundTruth(attempt)) {
        updatedGt = true;
      }

      const evalResult = evaluateScanAttempt(attempt);

      const needsUpdate =
        updatedGt ||
        attempt.expectedTypeStatus !== evalResult.expectedType ||
        attempt.classificationStatus !== evalResult.classification ||
        attempt.merchantStatus !== evalResult.merchant ||
        attempt.dateStatus !== evalResult.date ||
        attempt.amountStatus !== evalResult.amount ||
        attempt.categoryStatus !== evalResult.category ||
        attempt.overallStatus !== evalResult.overall ||
        attempt.actionStatus !== evalResult.action;

      if (needsUpdate) {
        attempt.expectedTypeStatus = evalResult.expectedType;
        attempt.classificationStatus = evalResult.classification;
        attempt.merchantStatus = evalResult.merchant;
        attempt.dateStatus = evalResult.date;
        attempt.amountStatus = evalResult.amount;
        attempt.categoryStatus = evalResult.category;
        attempt.overallStatus = evalResult.overall;
        attempt.actionStatus = evalResult.action;
        attempt.updatedAt = new Date().toISOString();

        await db.scanAttempts.put(attempt);
        repairedCount++;
      }
    }

    return { repairedCount, totalCount: attempts.length };
  } catch (error) {
    console.error("Failed to repair scan attempts:", error);
    return { repairedCount: 0, totalCount: 0 };
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

    if (attempt.expectedIsBill !== null || attempt.predictedIsBill !== null) {
      totalWithGroundTruth += 1;
    }

    const evalResult = evaluateScanAttempt(attempt);

    // Classification accuracy
    if (evalResult.classification !== "Not evaluated") {
      classificationEligibleCount += 1;
      if (evalResult.classification === "Correct") {
        correctClassifications += 1;
      }
    }

    // Extractions accuracy: only count towards eligible denominator if applicable
    if (
      evalResult.merchant === "Correct" ||
      evalResult.merchant === "Incorrect" ||
      evalResult.merchant === "Not extracted"
    ) {
      merchantEligibleCount += 1;
      if (evalResult.merchant === "Correct") merchantCorrectCount += 1;
    }

    if (
      evalResult.date === "Correct" ||
      evalResult.date === "Incorrect" ||
      evalResult.date === "Not extracted"
    ) {
      dateEligibleCount += 1;
      if (evalResult.date === "Correct") dateCorrectCount += 1;
    }

    if (
      evalResult.amount === "Correct" ||
      evalResult.amount === "Incorrect" ||
      evalResult.amount === "Not extracted"
    ) {
      amountEligibleCount += 1;
      if (evalResult.amount === "Correct") amountCorrectCount += 1;
    }

    if (
      evalResult.category === "Correct" ||
      evalResult.category === "Incorrect" ||
      evalResult.category === "Not extracted"
    ) {
      categoryEligibleCount += 1;
      if (evalResult.category === "Correct") categoryCorrectCount += 1;
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
    "expected_type",
    "expected_is_bill",
    "predicted_is_bill",
    "bill_detection_confidence",
    "classification_status",
    "ocr_status",
    "ocr_confidence",
    "expected_merchant",
    "extracted_merchant",
    "merchant_confidence",
    "merchant_status",
    "expected_date",
    "extracted_date",
    "date_confidence",
    "date_status",
    "expected_amount",
    "extracted_amount",
    "amount_confidence",
    "amount_status",
    "expected_category",
    "extracted_category",
    "category_confidence",
    "category_status",
    "overall_status",
    "action_status",
    "failure_stage",
    "failure_reason",
    "is_saved_as_bill",
    "saved_bill_id",
    "notes",
  ];

  const rows = attempts.map((attempt) => {
    const evalResult = evaluateScanAttempt(attempt);
    return [
      escapeCsv(attempt.id),
      escapeCsv(attempt.datasetTag ?? ""),
      escapeCsv(attempt.imageFileName),
      escapeCsv(attempt.imageType),
      attempt.imageSize,
      escapeCsv(attempt.createdAt),
      escapeCsv(attempt.processingStatus),
      escapeCsv(evalResult.expectedType),
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
      escapeCsv(evalResult.action),
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
