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
}

const FINAL_LABELS: Array<{ pattern: RegExp; weight: number; label: string }> = [
  { pattern: /grand\s*total|g\.?\s*total/, weight: 12, label: "grand total" },
  { pattern: /amount\s*payable|amt\.?\s*payable/, weight: 11, label: "amount payable" },
  { pattern: /total\s*due|balance\s*due|amount\s*due/, weight: 10, label: "total due" },
  { pattern: /net\s*amount|net\s*total|net\s*payable/, weight: 9, label: "net amount" },
  { pattern: /bill\s*amount|invoice\s*total/, weight: 8, label: "bill amount" },
  { pattern: /\btotal\b/, weight: 6, label: "total" },
];

const AVOID_LABELS =
  /\b(sub\s*total|subtotal|taxable|cgst|sgst|igst|gst|vat|tax|discount|less|cash|tender(?:ed)?|change|round\s*off|qty|quantity|rate|mrp)\b/i;

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

  for (const line of lines) {
    const money = [...line.matchAll(MONEY_PATTERN)]
      .map((match) => parseMoney(match[0]))
      .filter((value): value is number => value !== null);

    if (money.length === 0) continue;

    const avoided = AVOID_LABELS.test(line);
    const labeled = FINAL_LABELS.find((item) => item.pattern.test(line.toLowerCase()));
    const amount = money[money.length - 1];

    if (labeled && !avoided) {
      candidates.push({
        amount,
        raw: line,
        weight: labeled.weight,
        label: labeled.label,
      });
      continue;
    }

    if (!avoided && /₹|rs\.?|inr/i.test(line) && amount >= 10) {
      candidates.push({
        amount,
        raw: line,
        weight: 2,
        label: "currency amount",
      });
    }
  }

  if (candidates.length === 0) {
    const fallback = [...text.matchAll(MONEY_PATTERN)]
      .map((match) => parseMoney(match[0]))
      .filter((value): value is number => value !== null)
      .sort((a, b) => b - a)[0];

    if (!fallback) {
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

    const review = resolveExtractionReview({
      hasValue: true,
      extractionReliable: false,
      ambiguous: true,
      ocrWordConfidence: snippetOcrConfidence(words, String(fallback)),
    });

    return {
      value: fallback,
      ...review,
      warning: "Please verify this amount",
      raw: String(fallback),
    };
  }

  candidates.sort((a, b) => b.weight - a.weight || b.amount - a.amount);
  const best = candidates[0];
  const competingAmounts = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.amount !== best.amount &&
          candidate.weight >= Math.max(2, best.weight - 3),
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

export function parseMoney(raw: string): number | null {
  const cleaned = sanitizeAmountInput(raw).replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) return null;
  return amount;
}

export function sanitizeAmountInput(raw: string): string {
  return raw
    .replace(/₹/g, "")
    .replace(/\b(rs\.?|inr)\b/gi, "")
    .replace(/[^\d.,]/g, "");
}

export function amountToInputValue(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
