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
  score: number;
}

export function extractDate(ocr: OcrResult | string): ExtractedField<string> {
  const text = typeof ocr === "string" ? ocr : ocr.text;
  const words = typeof ocr === "string" ? undefined : ocr.words;
  const candidates: DateCandidate[] = [];

  // Fix common OCR zero/O mixups in date strings
  const normalizedText = text.replace(/([0-9])[oO]([0-9])/g, "$10$2");

  // 1. Numeric with slashes, dashes, or dots: DD/MM/YYYY or MM/DD/YYYY
  const numeric = normalizedText.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g);
  for (const match of numeric) {
    const raw = match[0];
    const a = Number(match[1]);
    const b = Number(match[2]);
    const year = normalizeYear(Number(match[3]));
    if (!year) continue;

    // Check surrounding line context for "date" keyword
    const isNearbyDateWord = /date|dt\b|dated/i.test(
      findSurroundingContext(normalizedText, match.index ?? 0),
    );
    const contextScore = isNearbyDateWord ? 3 : 1;

    const bothCouldBeMonth = a <= 12 && b <= 12 && a !== b;
    const isoDayFirst = toIsoDate(year, b, a); // standard in India/UK/Europe: DD/MM/YYYY

    if (a > 12 && b <= 12) {
      // Must be DD/MM/YYYY
      const iso = toIsoDate(year, b, a);
      if (iso) candidates.push({ iso, raw, unambiguous: true, score: contextScore + 2 });
    } else if (b > 12 && a <= 12) {
      // Must be MM/DD/YYYY
      const iso = toIsoDate(year, a, b);
      if (iso) candidates.push({ iso, raw, unambiguous: true, score: contextScore + 2 });
    } else if (bothCouldBeMonth) {
      // Ambiguous date, prefer DD/MM/YYYY by default for Indian context but flag as ambiguous
      if (isoDayFirst) {
        candidates.push({ iso: isoDayFirst, raw, unambiguous: false, score: contextScore });
      }
    } else if (isoDayFirst) {
      candidates.push({ iso: isoDayFirst, raw, unambiguous: true, score: contextScore + 2 });
    }
  }

  // 2. ISO format YYYY-MM-DD or YYYY/MM/DD
  const isoOrder = normalizedText.matchAll(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g);
  for (const match of isoOrder) {
    const iso = toIsoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    if (iso) {
      const isNearbyDateWord = /date|dt\b|dated/i.test(
        findSurroundingContext(normalizedText, match.index ?? 0),
      );
      candidates.push({
        iso,
        raw: match[0],
        unambiguous: true,
        score: isNearbyDateWord ? 5 : 3,
      });
    }
  }

  // 3. Named month: DD MMM YYYY (e.g. 04 Nov 2026, 4 November 2026)
  const named = normalizedText.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/g);
  for (const match of named) {
    const month = MONTHS[match[2].toLowerCase()];
    const year = normalizeYear(Number(match[3]));
    if (!month || !year) continue;
    const iso = toIsoDate(year, month, Number(match[1]));
    if (iso) {
      candidates.push({ iso, raw: match[0], unambiguous: true, score: 5 });
    }
  }

  // 4. Named month first: MMM DD, YYYY (e.g. Nov 04, 2026)
  const namedFirst = normalizedText.matchAll(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})\b/g);
  for (const match of namedFirst) {
    const month = MONTHS[match[1].toLowerCase()];
    const year = normalizeYear(Number(match[3]));
    if (!month || !year) continue;
    const iso = toIsoDate(year, month, Number(match[2]));
    if (iso) {
      candidates.push({ iso, raw: match[0], unambiguous: true, score: 5 });
    }
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

  // Sort by score (context and unambiguousness)
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];

  const uniqueIsos = new Set(candidates.map((c) => c.iso));
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
  if (year >= 1990 && year <= 2040) return year;
  if (year >= 0 && year < 100) return year >= 70 ? 1900 + year : 2000 + year;
  return null;
}

function findSurroundingContext(text: string, index: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + 30);
  return text.slice(start, end);
}
