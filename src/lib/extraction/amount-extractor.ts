import type { ExtractedField, OcrResult } from "@/types/bill";
import {
  EXTRACTION_THRESHOLDS,
  resolveExtractionReview,
  snippetOcrConfidence,
} from "@/lib/extraction/confidence";

interface AmountCandidate {
  amount: number;
  raw: string;
  weight: number;
  label: string;
  lineIndex: number;
}

const FINAL_LABELS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /\b(grand\s*total|g\.?\s*total)\b/i, weight: 14, label: "grand total" },
  { pattern: /\b(amount\s*payable|amt\.?\s*payable|net\s*payable)\b/i, weight: 13, label: "amount payable" },
  { pattern: /\b(total\s*due|balance\s*due|amount\s*due)\b/i, weight: 12, label: "total due" },
  { pattern: /\b(net\s*amount|net\s*total)\b/i, weight: 11, label: "net amount" },
  { pattern: /\b(bill\s*amount|total\s*amount|invoice\s*total)\b/i, weight: 10, label: "bill amount" },
  { pattern: /\b(total|tot\b)\b/i, weight: 7, label: "total" },
];

const AVOID_LABELS =
  /\b(sub\s*total|subtotal|taxable|cgst|sgst|igst|gst|vat|tax|discount|less|cash|tender(?:ed)?|change\s*return|balance\s*return|round\s*off|qty|quantity|rate|mrp|items?)\b/i;

const DATE_LINE_PATTERN = /\bdate\b|\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/i;

const MONEY_PATTERN =
  /(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]+)(?:\.([0-9]{1,2}))?/gi;

export function extractAmount(ocr: OcrResult | string): ExtractedField<number> {
  const text = typeof ocr === "string" ? ocr : ocr.text;
  const words = typeof ocr === "string" ? undefined : ocr.words;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: AmountCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    // If the line is purely a date line, do not extract year numbers as amounts
    const isDateLine = DATE_LINE_PATTERN.test(line) && !/total|amount|payable/i.test(line);

    const moneyValues = extractMoneyFromLine(line);
    if (moneyValues.length === 0) return;

    const avoided = AVOID_LABELS.test(line);
    const matchedLabel = FINAL_LABELS.find((item) => item.pattern.test(line));
    const amount = moneyValues[moneyValues.length - 1];

    if (isDateLine && (amount >= 1990 && amount <= 2040)) {
      // Discard year numbers misread as amounts
      return;
    }

    if (matchedLabel && !avoided) {
      candidates.push({
        amount,
        raw: line,
        weight: matchedLabel.weight,
        label: matchedLabel.label,
        lineIndex,
      });
      return;
    }

    // Currency symbol match on a non-avoided line
    if (!avoided && !isDateLine && /(?:₹|rs\.?|inr)/i.test(line) && amount >= 1) {
      candidates.push({
        amount,
        raw: line,
        weight: 3,
        label: "currency amount",
        lineIndex,
      });
    }
  });

  if (candidates.length === 0) {
    // Fallback: search all money patterns in lines, skipping obvious date lines and subtotal/tax lines
    const fallbacks: AmountCandidate[] = [];
    lines.forEach((line, lineIndex) => {
      if (DATE_LINE_PATTERN.test(line) && !/total|amount/i.test(line)) return;
      if (AVOID_LABELS.test(line)) return;
      const values = extractMoneyFromLine(line);
      for (const val of values) {
        if (val >= 1990 && val <= 2040 && line.toLowerCase().includes("date")) continue;
        fallbacks.push({
          amount: val,
          raw: line,
          weight: 1,
          label: "fallback amount",
          lineIndex,
        });
      }
    });

    if (fallbacks.length === 0) {
      return {
        value: null,
        ...resolveExtractionReview({
          hasValue: false,
          extractionReliable: false,
          ocrWordConfidence: null,
        }),
        warning: "No total amount was found. Please enter it.",
      };
    }

    // Sort by line position (totals usually appear towards bottom) and amount
    fallbacks.sort((a, b) => b.lineIndex - a.lineIndex || b.amount - a.amount);
    const bestFallback = fallbacks[0];

    const review = resolveExtractionReview({
      hasValue: true,
      extractionReliable: false,
      ambiguous: true,
      ocrWordConfidence: snippetOcrConfidence(words, String(bestFallback.amount)),
    });

    return {
      value: bestFallback.amount,
      ...review,
      warning: "Please verify this amount",
      raw: bestFallback.raw,
    };
  }

  // Sort candidates:
  // Primary: highest weight (e.g. Grand Total > Total > Currency)
  // Secondary: later in document (totals appear near bottom)
  candidates.sort((a, b) => b.weight - a.weight || b.lineIndex - a.lineIndex);
  const best = candidates[0];

  const competingAmounts = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.amount !== best.amount &&
          candidate.weight >= Math.max(3, best.weight - 2),
      )
      .map((candidate) => candidate.amount),
  );

  const labeledFinal = best.weight >= EXTRACTION_THRESHOLDS.amountLabeledMinWeight;
  const ambiguous = competingAmounts.size > 0 || !labeledFinal;
  const review = resolveExtractionReview({
    hasValue: true,
    extractionReliable: labeledFinal && competingAmounts.size === 0,
    ambiguous,
    ocrWordConfidence: snippetOcrConfidence(words, best.raw),
  });

  return {
    value: best.amount,
    ...review,
    warning:
      competingAmounts.size > 0
        ? "More than one amount was found. Please verify the total."
        : review.status === "needs_review"
          ? "Please verify this amount"
          : undefined,
    raw: best.raw,
  };
}

function extractMoneyFromLine(line: string): number[] {
  const matches = [...line.matchAll(MONEY_PATTERN)];
  const results: number[] = [];
  for (const m of matches) {
    const val = parseMoney(m[0]);
    if (val !== null) results.push(val);
  }
  return results;
}

export function parseMoney(raw: string): number | null {
  const cleaned = sanitizeAmountInput(raw).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) return null;
  return amount;
}

export function sanitizeAmountInput(raw: string): string {
  return raw
    .replace(/₹/g, "")
    .replace(/(?:^|\b)(?:rs\.?|inr)\s*/gi, "")
    .replace(/[^\d.,]/g, "")
    .replace(/^\.+/, "") // remove leading dots (e.g. from ".451.50")
    .replace(/\.+$/, ""); // remove trailing dots
}

export function amountToInputValue(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
