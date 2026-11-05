export const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Shopping",
  "Utilities",
  "Transport",
  "Healthcare",
  "Entertainment",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExtractionReliability = "high" | "uncertain" | "not_detected";

export type FieldReviewStatus =
  | "high_confidence"
  | "needs_review"
  | "missing"
  | "user_verified"
  | "verified";

export type DetectionDecision = "bill" | "not_bill" | "uncertain";

export interface BillDetectionResult {
  isBill: boolean;
  confidence: number;
  score: number;
  reasons: string[];
  warnings: string[];
  decision: DetectionDecision;
}

export interface ExtractedField<T> {
  value: T | null;
  /** Internal heuristic only — not a calibrated probability. */
  confidence: number;
  /** Average matching OCR word score (0–100), or null when unavailable. */
  ocrConfidence: number | null;
  reliability: ExtractionReliability;
  status: FieldReviewStatus;
  warning?: string;
  raw?: string;
}

export interface OriginalExtraction {
  merchantName: string | null;
  date: string | null;
  totalAmount: number | null;
  category: ExpenseCategory | null;
}

export interface ExtractionResult {
  merchantName: ExtractedField<string>;
  date: ExtractedField<string>;
  totalAmount: ExtractedField<number>;
  category: ExtractedField<ExpenseCategory>;
}

export interface FieldReviewMap {
  merchantName: FieldReviewStatus;
  date: FieldReviewStatus;
  totalAmount: FieldReviewStatus;
  category: FieldReviewStatus;
}

export interface Bill {
  id: string;
  merchantName: string;
  date: string;
  totalAmount: number;
  category: ExpenseCategory;
  imageBlob: Blob;
  originalOcrText: string;
  createdAt: string;
  updatedAt: string;
  detectionConfidence: number;
  fieldReviewStatus: FieldReviewMap;
  originalExtraction?: OriginalExtraction;
}

export interface BillInput {
  merchantName: string;
  date: string;
  totalAmount: number;
  category: ExpenseCategory;
  imageBlob: Blob;
  originalOcrText: string;
  detectionConfidence: number;
  fieldReviewStatus: FieldReviewMap;
  originalExtraction?: OriginalExtraction;
}

export interface OcrWord {
  text: string;
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  meanConfidence: number;
}

export interface ScanDraft {
  id: "current";
  imageBlob: Blob;
  originalOcrText: string;
  meanOcrConfidence: number;
  detection: BillDetectionResult;
  extraction: ExtractionResult;
  createdAt: string;
}

export type BillSortKey = "date-desc" | "date-asc" | "amount-desc" | "amount-asc";
