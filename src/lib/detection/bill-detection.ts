import type { BillDetectionResult, OcrResult } from "@/types/bill";
import {
  BILL_ACCEPT_THRESHOLD,
  BILL_UNCERTAIN_THRESHOLD,
  DATE_HINT,
  MONEY_HINT,
  NEGATIVE_PATTERNS,
  POSITIVE_PATTERNS,
} from "@/lib/detection/detection-rules";

export function detectBill(ocr: OcrResult): BillDetectionResult {
  const text = ocr.text ?? "";
  const compact = text.replace(/\s+/g, " ").trim();
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  if (compact.length < 20 || ocr.words.length < 6) {
    score -= 4;
    warnings.push("Very little readable text was found");
  } else if (compact.length > 40) {
    score += 1;
    reasons.push("The image contains a useful amount of text");
  }

  if (ocr.meanConfidence > 0 && ocr.meanConfidence < 40) {
    score -= 1;
    warnings.push("The text is hard to read, so detection is less certain");
  }

  for (const rule of POSITIVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  if (DATE_HINT.test(text)) {
    score += 2;
    reasons.push("Found a date");
  }

  if (MONEY_HINT.test(text)) {
    score += 2;
    reasons.push("Found currency-style amounts");
  }

  const moneyHits = text.match(/(?:₹|rs\.?)\s*\d|(?:\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?)/gi) ?? [];
  if (moneyHits.length >= 2) {
    score += 1;
    reasons.push("Found more than one monetary value");
  }

  for (const rule of NEGATIVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      score -= rule.weight;
      warnings.push(rule.reason);
    }
  }

  const alphaRatio = alphaCharacterRatio(compact);
  if (compact.length > 0 && alphaRatio < 0.15) {
    score -= 3;
    warnings.push("The image does not contain much readable language");
  }

  let decision: BillDetectionResult["decision"];
  if (score >= BILL_ACCEPT_THRESHOLD && !hasBlockingNegative(warnings)) {
    decision = "bill";
  } else if (score <= BILL_UNCERTAIN_THRESHOLD || hasBlockingNegative(warnings)) {
    decision = "not_bill";
  } else {
    decision = "uncertain";
  }

  const confidence = clamp((score + 6) / 16, 0, 1);

  return {
    isBill: decision === "bill",
    confidence: Number(confidence.toFixed(2)),
    score,
    reasons,
    warnings,
    decision,
  };
}

function hasBlockingNegative(warnings: string[]): boolean {
  return warnings.some(
    (warning) =>
      warning.includes("identity") ||
      warning.includes("passport") ||
      warning.includes("social media"),
  );
}

function alphaCharacterRatio(text: string): number {
  if (!text) return 0;
  const letters = text.replace(/[^A-Za-z]/g, "").length;
  return letters / text.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
