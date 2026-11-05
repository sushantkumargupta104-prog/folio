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

  // Text density check
  if (compact.length < 15 || ocr.words.length < 4) {
    score -= 4;
    warnings.push("Very little readable text was found");
  } else if (compact.length >= 35) {
    score += 1;
    reasons.push("The image contains a useful amount of text");
  }

  // OCR confidence influence
  if (ocr.meanConfidence > 0 && ocr.meanConfidence < 40) {
    score -= 1;
    warnings.push("The text is faint or blurry, reducing detection certainty");
  }

  // Positive pattern scoring
  for (const rule of POSITIVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }

  // Date hint
  if (DATE_HINT.test(text)) {
    score += 2;
    reasons.push("Found a calendar date");
  }

  // Money / currency hints
  if (MONEY_HINT.test(text)) {
    score += 2;
    reasons.push("Found monetary values");
  }

  // Multiple money values check (line items + total)
  const moneyMatches =
    text.match(/(?:₹|rs\.?|inr)\s*\d+(?:\.\d{2})?|\b\d{1,3}(?:,\d{2,3})*(?:\.\d{2})\b/gi) ?? [];
  if (moneyMatches.length >= 2) {
    score += 1;
    reasons.push("Found multiple pricing entries");
  }

  // Negative pattern scoring
  let hasHardNegative = false;
  for (const rule of NEGATIVE_PATTERNS) {
    if (rule.pattern.test(text)) {
      score -= rule.weight;
      warnings.push(rule.reason);
      hasHardNegative = true;
    }
  }

  // Alphabet vs symbol ratio
  const alphaRatio = alphaCharacterRatio(compact);
  if (compact.length > 0 && alphaRatio < 0.15) {
    score -= 3;
    warnings.push("Text lacks standard linguistic structure");
  }

  let decision: BillDetectionResult["decision"];
  if (hasHardNegative) {
    decision = "not_bill";
  } else if (score >= BILL_ACCEPT_THRESHOLD) {
    decision = "bill";
  } else if (score <= BILL_UNCERTAIN_THRESHOLD) {
    decision = "not_bill";
  } else {
    decision = "uncertain";
  }

  const confidence = clamp((score + 4) / 16, 0, 1);

  return {
    isBill: decision === "bill",
    confidence: Number(confidence.toFixed(2)),
    score,
    reasons,
    warnings,
    decision,
  };
}

function alphaCharacterRatio(text: string): number {
  if (!text) return 0;
  const letters = text.replace(/[^A-Za-z]/g, "").length;
  return letters / text.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
