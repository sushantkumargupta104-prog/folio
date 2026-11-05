import type { ExtractedField, OcrResult } from "@/types/bill";
import { resolveExtractionReview, snippetOcrConfidence } from "@/lib/extraction/confidence";
import { toIsoDate } from "@/utils/format";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

interface DateCandidate {
  iso: string;
  raw: string;
  unambiguous: boolean;
}

export function extractDate(ocr: OcrResult | string): ExtractedField<string> {
  const text = typeof ocr === "string" ? ocr : ocr.text;
  const words = typeof ocr === "string" ? undefined : ocr.words;
  const candidates: DateCandidate[] = [];

  const numeric = text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g);
  for (const match of numeric) {
    const raw = match[0];
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = normalizeYear(Number(match[3]));
    if (!year) continue;

    const bothCouldBeMonth = a <= 12 && b <= 12 && a !== b;
    const isoDayFirst = toIsoDate(year, b, a);
    const isoMonthFirst = toIsoDate(year, a, b);

    if (a > 12 && b <= 12) {
      const iso = toIsoDate(year, b, a);
      if (iso) candidates.push({ iso, raw, unambiguous: true });
    } else if (b > 12 && a <= 12) {
      const iso = toIsoDate(year, a, b);
      if (iso) candidates.push({ iso, raw, unambiguous: true });
    } else if (bothCouldBeMonth) {
      if (isoDayFirst) candidates.push({ iso: isoDayFirst, raw, unambiguous: false });
      if (isoMonthFirst && isoMonthFirst !== isoDayFirst) {
        candidates.push({ iso: isoMonthFirst, raw, unambiguous: false });
      }
    } else if (isoDayFirst) {
      candidates.push({ iso: isoDayFirst, raw, unambiguous: true });
    }
  }

  const isoOrder = text.matchAll(/\b(\d{4})[/-](\d{1,2})[/-](\d{1,2})\b/g);
  for (const match of isoOrder) {
    const iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) candidates.push({ iso, raw: match[0], unambiguous: true });
  }

  const named = text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/g);
  for (const match of named) {
    const month = MONTHS[match[2].toLowerCase()];
    const year = normalizeYear(Number(match[3]));
    if (!month || !year) continue;
    const iso = toIsoDate(year, month, Number(match[1]));
    if (iso) candidates.push({ iso, raw: match[0], unambiguous: true });
  }

  const namedFirst = text.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b/g);
  for (const match of namedFirst) {
    const month = MONTHS[match[1].toLowerCase()];
    const year = normalizeYear(Number(match[3]));
    if (!month || !year) continue;
    const iso = toIsoDate(year, month, Number(match[2]));
    if (iso) candidates.push({ iso, raw: match[0], unambiguous: true });
  }

  if (candidates.length === 0) {
    return {
      value: null,
      ...resolveExtractionReview({
        hasValue: false,
        extractionReliable: false,
        ocrWordConfidence: null,
      }),
      warning: "No date was found. Please enter it.",
    };
  }

  const uniqueIsos = new Set(candidates.map((candidate) => candidate.iso));
  const best =
    candidates.find((candidate) => candidate.unambiguous) ??
    candidates[0];
  const ambiguous = !best.unambiguous || uniqueIsos.size > 1;
  const ocrWordConfidence = snippetOcrConfidence(words, best.raw);
  const review = resolveExtractionReview({
    hasValue: true,
    extractionReliable: best.unambiguous && uniqueIsos.size === 1,
    ambiguous,
    ocrWordConfidence,
  });

  return {
    value: best.iso,
    ...review,
    warning: ambiguous
      ? "This date could be read in more than one format"
      : review.status === "needs_review"
        ? "Please verify this date"
        : undefined,
    raw: best.raw,
  };
}

function normalizeYear(year: number): number | null {
  if (year >= 1000 && year <= 2100) return year;
  if (year >= 0 && year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return null;
}
