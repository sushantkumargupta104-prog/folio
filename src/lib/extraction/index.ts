import type { ExtractionResult, OcrResult } from "@/types/bill";
import { extractAmount } from "@/lib/extraction/amount-extractor";
import { classifyCategory } from "@/lib/extraction/category-classifier";
import { extractDate } from "@/lib/extraction/date-extractor";
import { extractMerchant } from "@/lib/extraction/merchant-extractor";

export function extractBillFields(ocr: OcrResult): ExtractionResult {
  const merchantName = extractMerchant(ocr);
  const date = extractDate(ocr);
  const totalAmount = extractAmount(ocr);
  const category = classifyCategory(ocr.text, merchantName.value);

  return {
    merchantName,
    date,
    totalAmount,
    category,
  };
}

export { extractAmount, classifyCategory, extractDate, extractMerchant };
