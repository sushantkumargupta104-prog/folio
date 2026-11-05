import type { ExpenseCategory } from "@/types/bill";

export type ProcessingStatus =
  | "pending"
  | "preprocessing"
  | "reading_ocr"
  | "detecting"
  | "extracting"
  | "completed"
  | "failed"
  | "cancelled";

export type FailureStage =
  | "validation"
  | "preprocessing"
  | "ocr"
  | "detection"
  | "extraction"
  | null;

export type OcrStatus = "pending" | "success" | "failed" | "skipped";

export type ComparisonResult = "correct" | "incorrect" | "not_applicable" | "pending";

export interface EvaluationGroundTruth {
  expectedIsBill: boolean | null;
  expectedMerchant: string | null;
  expectedDate: string | null;
  expectedAmount: number | null;
  expectedCategory: ExpenseCategory | null;
  datasetTag?: string | null;
  notes?: string | null;
}

export interface ScanAttempt {
  id: string;
  imageId: string;
  imageBlob: Blob | null;
  imageFileName: string;
  imageType: string;
  imageSize: number;
  createdAt: string;
  updatedAt: string;

  processingStatus: ProcessingStatus;

  // Bill detection
  predictedIsBill: boolean | null;
  billDetectionConfidence: number | null;
  billDetectionReasons: string[] | null;
  billDetectionWarnings: string[] | null;

  // OCR
  ocrStatus: OcrStatus;
  ocrExtractedText: string | null;
  ocrConfidence: number | null;

  // Extraction
  extractedMerchant: string | null;
  extractedDate: string | null;
  extractedAmount: number | null;
  extractedCategory: ExpenseCategory | null;

  merchantConfidence: number | null;
  dateConfidence: number | null;
  amountConfidence: number | null;
  categoryConfidence: number | null;

  // Failure tracking
  failureStage: FailureStage;
  failureReason: string | null;
  errorDetails: string | null;

  // Association with saved expense
  isSavedAsBill: boolean;
  savedBillId: string | null;

  // Ground truth
  expectedIsBill: boolean | null;
  expectedMerchant: string | null;
  expectedDate: string | null;
  expectedAmount: number | null;
  expectedCategory: ExpenseCategory | null;
  datasetTag: string | null;
  notes: string | null;
}

export interface CalculatedEvaluation {
  classification: ComparisonResult;
  merchant: ComparisonResult;
  date: ComparisonResult;
  amount: ComparisonResult;
  category: ComparisonResult;
  overall: "passed" | "failed" | "pending";
}

export interface EvaluationSummary {
  totalEvaluated: number;
  totalWithGroundTruth: number;
  correctClassifications: number;
  classificationAccuracy: number | null; // null if denominator 0
  classificationEligibleCount: number;

  merchantCorrectCount: number;
  merchantEligibleCount: number;
  merchantAccuracy: number | null;

  dateCorrectCount: number;
  dateEligibleCount: number;
  dateAccuracy: number | null;

  amountCorrectCount: number;
  amountEligibleCount: number;
  amountAccuracy: number | null;

  categoryCorrectCount: number;
  categoryEligibleCount: number;
  categoryAccuracy: number | null;

  ocrFailureCount: number;
  billDetectionRejections: number;
}
