import type { ExtractedField, OcrResult } from "@/types/bill";
import {
  EXTRACTION_THRESHOLDS,
  resolveExtractionReview,
  snippetOcrConfidence,
} from "@/lib/extraction/confidence";

const SKIP_LINE =
  /^(tel|phone|ph|mob|mobile|gstin|gst|cin|fssai|www|http|thank|welcome|invoice|tax invoice|cash memo|receipt|bill|date|time|address|customer|cust|token|counter|tin|total|amount|grand|net|subtotal|qty|quantity|item)\b/i;

const SKIP_CONTENT =
  /\b(road|street|nagar|layout|pincode|pin\s*code|district|state|india|gmail|yahoo|hotmail|ltd\.?|pvt\.?)\b/i;

const PHONE = /(\+?\d[\d\s-]{7,}\d)/;
const GSTIN = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i;

export function extractMerchant(ocr: OcrResult | string): ExtractedField<string> {
  const text = typeof ocr === "string" ? ocr : ocr.text;
  const words = typeof ocr === "string" ? undefined : ocr.words;

  const lines = text
    .split(/\n+/)
    .map((line) => cleanLine(line))
    .filter((line) => line.length >= 3);

  const header = lines.slice(0, 12);
  const candidates: Array<{ value: string; score: number; raw: string }> = [];

  for (const line of header) {
    if (SKIP_LINE.test(line)) continue;
    if (PHONE.test(line) && line.replace(PHONE, "").trim().length < 4) continue;
    if (GSTIN.test(line)) continue;
    if (/^\d[\d\s./:-]*$/.test(line)) continue;
    if (/(?:₹|rs\.?|inr)\s*\d/i.test(line)) continue;
    if (/\d+\.\d{2}\b/.test(line) && line.replace(/[^A-Za-z]/g, "").length < 8) continue;
    if (SKIP_CONTENT.test(line) && !/[A-Za-z]{4,}/.test(line.split(" ")[0] ?? "")) {
      continue;
    }
    if (line.length > 42) continue;

    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) continue;

    let score = 3;
    if (/^[A-Z0-9 &.'-]{3,}$/.test(line) && letters.length >= 4) score += 2;
    if (line.split(/\s+/).length <= 5) score += 1;
    if (SKIP_CONTENT.test(line)) score -= 2;

    const value = normalizeMerchant(line);
    if (value.length < 2) continue;
    candidates.push({ value, score, raw: line });
  }

  if (candidates.length === 0) {
    return {
      value: null,
      ...resolveExtractionReview({
        hasValue: false,
        extractionReliable: false,
        ocrWordConfidence: null,
      }),
      warning: "No merchant name was found. Please enter it.",
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const ocrWordConfidence = snippetOcrConfidence(words, best.raw);
  const extractionReliable =
    best.score >= EXTRACTION_THRESHOLDS.merchantMinScore && /[A-Za-z]{3,}/.test(best.value);
  const review = resolveExtractionReview({
    hasValue: true,
    extractionReliable,
    ocrWordConfidence,
  });

  return {
    value: best.value,
    ...review,
    warning: review.status === "needs_review" ? "Please verify the merchant name" : undefined,
    raw: best.raw,
  };
}

export function cleanMerchantName(value: string): string {
  return value
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanLine(line: string): string {
  return cleanMerchantName(line.replace(/[|*_=]+/g, " "));
}

function normalizeMerchant(value: string): string {
  return cleanMerchantName(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
