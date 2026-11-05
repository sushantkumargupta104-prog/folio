import type { ExtractedField, OcrResult } from "@/types/bill";
import {
  EXTRACTION_THRESHOLDS,
  resolveExtractionReview,
  snippetOcrConfidence,
} from "@/lib/extraction/confidence";

const SKIP_LINE_START =
  /^(tel|phone|ph|mob|mobile|gstin|gst|cin|fssai|tin|pan|www|http|https|thank|welcome|tax\s*invoice|invoice|cash\s*memo|receipt|bill\s*no|date|time|address|customer|token|table|counter|waiter|cashier|bill\s*to|ship\s*to|order\s*#|item|qty|rate|amount|total|subtotal)\b/i;

const ADDRESS_SIGNALS =
  /\b(road|street|st\b|rd\b|cross|main|lane|floor|bldg|building|opp\b|near|behind|beside|layout|sector|nagar|colony|block|pincode|pin\s*code|pin\s*[:#-]?\s*\d{6}|district|dist\b|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|pune|kolkata|karnataka|maharashtra|tamil\s*nadu)\b/i;

const PAYMENT_PROVIDER_SIGNALS =
  /\b(google\s*pay|phonepe|paytm|bhim|upi\s*id|hdfc\s*bank|icici|sbi\s*card|axis\s*bank|visa|mastercard|amex|merchant\s*id|terminal\s*id)\b/i;

const POSITIVE_MERCHANT_TERMS =
  /\b(cafe|café|coffee|restaurant|bakers|bakery|supermarket|mart|store|retail|pharmacy|chemist|kitchen|diner|bistro|pizzeria|hotel|motors|automobiles|auto|fuels?|petrol|pvt\.?\s*ltd|ltd\b|enterprises|services)\b/i;

const PHONE_REGEX = /(\+?\d[\d\s-]{7,}\d)/;
const GSTIN_REGEX = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/i;

export function extractMerchant(ocr: OcrResult | string): ExtractedField<string> {
  const text = typeof ocr === "string" ? ocr : ocr.text;
  const words = typeof ocr === "string" ? undefined : ocr.words;

  const rawLines = text
    .split(/\n+/)
    .map((line) => cleanLine(line))
    .filter((line) => line.length >= 3);

  // Search through top 12 lines for business name
  const header = rawLines.slice(0, 12);
  const candidates: Array<{ value: string; score: number; raw: string; lineIndex: number }> = [];

  header.forEach((line, lineIndex) => {
    if (SKIP_LINE_START.test(line)) return;
    if (PAYMENT_PROVIDER_SIGNALS.test(line)) return;
    if (GSTIN_REGEX.test(line)) return;
    if (PHONE_REGEX.test(line) && line.replace(PHONE_REGEX, "").trim().length < 4) return;
    if (/^\d[\d\s./:-]*$/.test(line)) return; // purely numbers/dates/times
    if (/(?:₹|rs\.?|inr)\s*\d/i.test(line)) return; // contains currency prices
    if (/\d+\.\d{2}\b/.test(line) && line.replace(/[^A-Za-z]/g, "").length < 8) return;

    // Check if line looks like an address line
    const isAddress = ADDRESS_SIGNALS.test(line);
    if (isAddress && !POSITIVE_MERCHANT_TERMS.test(line)) {
      return;
    }

    if (line.length > 50) return;

    const letters = line.replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) return;

    let score = 4;

    // Earlier lines (first 1 to 4) are heavily preferred for merchant headers
    if (lineIndex === 0) score += 4;
    else if (lineIndex <= 2) score += 2;
    else if (lineIndex > 6) score -= 2;

    // Positive indicators
    if (POSITIVE_MERCHANT_TERMS.test(line)) score += 3;
    if (/^[A-Z0-9 &.'-]{3,}$/.test(line) && letters.length >= 4) score += 2; // Uppercase header
    if (line.split(/\s+/).length <= 4) score += 1;

    // Address penalty
    if (isAddress) score -= 4;

    const normalizedValue = normalizeMerchant(line);
    if (normalizedValue.length >= 3) {
      candidates.push({ value: normalizedValue, score, raw: line, lineIndex });
    }
  });

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

  candidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
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
  return cleanMerchantName(line.replace(/[|*_=~]+/g, " "));
}

function normalizeMerchant(value: string): string {
  return cleanMerchantName(value)
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
