import type {
  ExtractionReliability,
  FieldReviewStatus,
  OcrWord,
} from "@/types/bill";

/**
 * Heuristic cut-offs for combining OCR word scores with field validation.
 * These are not statistically calibrated probabilities.
 */
export const EXTRACTION_THRESHOLDS = {
  /** Tesseract word confidence is typically 0–100. */
  ocrHigh: 75,
  ocrLow: 55,
  merchantMinScore: 4,
  amountLabeledMinWeight: 6,
} as const;

export function snippetOcrConfidence(
  words: OcrWord[] | undefined,
  snippet: string | undefined,
): number | null {
  if (!words?.length || !snippet?.trim()) return null;

  const haystack = words.map((word) => normalizeToken(word.text));
  const needles = snippet
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 1);

  if (needles.length === 0) return null;

  const matched: number[] = [];
  for (const needle of needles) {
    let best: number | null = null;
    for (let index = 0; index < words.length; index += 1) {
      const token = haystack[index];
      if (!token) continue;
      if (token === needle || token.includes(needle) || needle.includes(token)) {
        const confidence = words[index].confidence;
        best = best == null ? confidence : Math.max(best, confidence);
      }
    }
    if (best != null) matched.push(best);
  }

  if (matched.length === 0) return null;
  return matched.reduce((sum, value) => sum + value, 0) / matched.length;
}

export function resolveExtractionReview(options: {
  hasValue: boolean;
  extractionReliable: boolean;
  ambiguous?: boolean;
  ocrWordConfidence: number | null;
}): {
  reliability: ExtractionReliability;
  status: FieldReviewStatus;
  ocrConfidence: number | null;
  /** Internal heuristic only — do not show as a probability. */
  confidence: number;
} {
  const ocrConfidence =
    options.ocrWordConfidence != null && Number.isFinite(options.ocrWordConfidence)
      ? Number(options.ocrWordConfidence.toFixed(1))
      : null;

  if (!options.hasValue) {
    return {
      reliability: "not_detected",
      status: "missing",
      ocrConfidence,
      confidence: 0,
    };
  }

  const ocrWeak = ocrConfidence != null && ocrConfidence < EXTRACTION_THRESHOLDS.ocrLow;
  const ocrStrong = ocrConfidence == null || ocrConfidence >= EXTRACTION_THRESHOLDS.ocrHigh;
  const high = options.extractionReliable && !options.ambiguous && !ocrWeak && ocrStrong;

  if (high) {
    return {
      reliability: "high",
      status: "high_confidence",
      ocrConfidence,
      confidence: 0.82,
    };
  }

  return {
    reliability: "uncertain",
    status: "needs_review",
    ocrConfidence,
    confidence: options.ambiguous ? 0.45 : 0.55,
  };
}

export type VisibleFieldReviewStatus = Exclude<FieldReviewStatus, "verified">;

export function normalizeFieldReviewStatus(
  status: string | undefined,
): VisibleFieldReviewStatus {
  if (status === "verified") return "high_confidence";
  if (
    status === "high_confidence" ||
    status === "needs_review" ||
    status === "missing" ||
    status === "user_verified"
  ) {
    return status;
  }
  return "needs_review";
}

export function statusAfterUserEdit(
  current: string,
  original: string | null | undefined,
  extractedStatus: FieldReviewStatus,
): FieldReviewStatus {
  const currentValue = current.trim();
  const originalValue = String(original ?? "").trim();
  if (currentValue !== originalValue) {
    return currentValue ? "user_verified" : extractedStatus;
  }
  return normalizeFieldReviewStatus(extractedStatus);
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}.]/gu, "");
}
