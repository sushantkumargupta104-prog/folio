import { detectBill } from "../src/lib/detection/bill-detection.ts";
import { extractAmount } from "../src/lib/extraction/amount-extractor.ts";
import { extractDate } from "../src/lib/extraction/date-extractor.ts";
import { extractMerchant } from "../src/lib/extraction/merchant-extractor.ts";
import { classifyCategory } from "../src/lib/extraction/category-classifier.ts";
import {
  evaluateScanAttempt,
  calculateEvaluationSummary,
  exportEvaluationCsv,
} from "../src/lib/db/evaluation-service.ts";

console.log("=================================================");
console.log("FOLIO EVALUATION AND RELIABILITY TEST SUITE");
console.log("=================================================");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    passedTests++;
    console.log(`✅ PASSED: ${message}`);
  }
}

// -----------------------------------------------------------
// TEST GROUP 1: BILL DETECTION (GENUINE BILLS)
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 1: Bill Detection (Genuine Bills) ---");

const cleanPrintedOcr = {
  text: `CAFE BLOOM
12 MG Road Bangalore
GSTIN: 29ABCDE1234F1Z5
Date: 04/11/2026
Cappuccino     180.00
Sandwich       250.00
Subtotal       430.00
GST 5%          21.50
Grand Total   Rs. 451.50
Paid via UPI`,
  words: [{ text: "CAFE", confidence: 95 }, { text: "Grand", confidence: 92 }, { text: "Total", confidence: 94 }],
  meanConfidence: 93,
};
const det1 = detectBill(cleanPrintedOcr);
assert(det1.decision === "bill" && det1.isBill === true, "Clean printed receipt recognized as bill");

const digitalScreenshotOcr = {
  text: `9:41 LTE 100%
Amazon India Invoice
Order # 402-1234567-8901234
Invoice Date: 2026-11-02
Item: Wireless Mouse  Qty: 1   1499.00
Net Amount: ₹1,499.00
Payment Method: HDFC Card`,
  words: [{ text: "Amazon", confidence: 98 }, { text: "Invoice", confidence: 95 }],
  meanConfidence: 96,
};
const det2 = detectBill(digitalScreenshotOcr);
assert(det2.decision === "bill", "Digital screenshot invoice recognized as bill despite status bar");

const handwrittenOcr = {
  text: `Sri Krishna Store
Kirana & General
Date: 11-10-2026
Rice 5kg 320.00
Total Amount Rs 320
Paid Cash`,
  words: [{ text: "Krishna", confidence: 52 }, { text: "Total", confidence: 58 }],
  meanConfidence: 55,
};
const det3 = detectBill(handwrittenOcr);
assert(det3.decision === "bill", "Handwritten bill recognized as bill");

// -----------------------------------------------------------
// TEST GROUP 2: BILL DETECTION (NON-BILLS)
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 2: Bill Detection (Non-Bills) ---");

const selfieOcr = {
  text: `Liked by priya and 142 others
comments view all 12 comments
send message instagram story`,
  words: [{ text: "Liked", confidence: 85 }],
  meanConfidence: 85,
};
assert(detectBill(selfieOcr).decision === "not_bill", "Social selfie interface rejected as not_bill");

const idCardOcr = {
  text: `Government of India
Unique Identification Authority of India
Aadhaar
Name: Rajesh Kumar
DOB: 15/08/1990
Gender: Male
1234 5678 9012`,
  words: [{ text: "Government", confidence: 90 }, { text: "Aadhaar", confidence: 92 }],
  meanConfidence: 91,
};
assert(detectBill(idCardOcr).decision === "not_bill", "Government Aadhaar card rejected as not_bill");

// -----------------------------------------------------------
// TEST GROUP 3: EXTRACTIONS
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 3: Extractions (Merchant, Date, Amount, Category) ---");

const amt1 = extractAmount(cleanPrintedOcr);
assert(amt1.value === 451.5, `Extracted 451.5 from "Grand Total Rs. 451.50" (got ${amt1.value})`);

const m1 = extractMerchant(cleanPrintedOcr);
assert(m1.value?.toLowerCase().includes("bloom"), `Extracted merchant Cafe Bloom (got "${m1.value}")`);

const d1 = extractDate(cleanPrintedOcr);
assert(d1.value === "2026-11-04", `Extracted date as ISO 2026-11-04 (got "${d1.value}")`);

const cat1 = classifyCategory("Cafe Bloom Cappuccino Sandwich", "Cafe Bloom");
assert(cat1.value === "Food & Dining", `Classified as Food & Dining (got "${cat1.value}")`);

// -----------------------------------------------------------
// TEST GROUP 4: 12 REQUIRED EVALUATION STATUS SCENARIOS
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 4: Verification of 12 Specific Evaluation Scenarios ---");

const baseAttempt = {
  id: "test-att-1",
  imageId: "img-1",
  imageBlob: null,
  imageFileName: "bill-01-printed.png",
  imageType: "image/png",
  imageSize: 120000,
  createdAt: "2026-11-05T10:00:00Z",
  updatedAt: "2026-11-05T10:00:00Z",
  processingStatus: "completed",
  predictedIsBill: true,
  billDetectionConfidence: 0.95,
  billDetectionReasons: ["Found total"],
  billDetectionWarnings: [],
  ocrStatus: "success",
  ocrExtractedText: "Cafe Bloom Rs 451.50",
  ocrConfidence: 92,
  extractedMerchant: "Cafe Bloom",
  extractedDate: "2026-11-04",
  extractedAmount: 451.5,
  extractedCategory: "Food & Dining",
  merchantConfidence: 0.9,
  dateConfidence: 0.9,
  amountConfidence: 0.9,
  categoryConfidence: 0.9,
  failureStage: null,
  failureReason: null,
  errorDetails: null,
  isSavedAsBill: true,
  savedBillId: "bill-1",
  expectedIsBill: true,
  expectedMerchant: "Cafe Bloom",
  expectedDate: "2026-11-04",
  expectedAmount: 451.5,
  expectedCategory: "Food & Dining",
  datasetTag: "bill-01-printed",
  notes: "Clean printed bill",
};

// Scenario 1: Genuine bill, all fields extracted correctly
const s1 = evaluateScanAttempt(baseAttempt);
assert(s1.expectedType === "Bill", "Scenario 1: Expected is 'Bill'");
assert(s1.classification === "Correct", "Scenario 1: Class is 'Correct'");
assert(s1.merchant === "Correct", "Scenario 1: Merchant is 'Correct'");
assert(s1.date === "Correct", "Scenario 1: Date is 'Correct'");
assert(s1.amount === "Correct", "Scenario 1: Amount is 'Correct'");
assert(s1.category === "Correct", "Scenario 1: Category is 'Correct'");
assert(s1.overall === "Correct", "Scenario 1: Overall is 'Correct'");
assert(s1.action === "View details", "Scenario 1: Action is 'View details'");

// Scenario 2: Genuine bill, incorrect merchant
const s2 = evaluateScanAttempt({ ...baseAttempt, extractedMerchant: "Wrong Merchant Ltd" });
assert(s2.merchant === "Incorrect", "Scenario 2: Merchant is 'Incorrect'");
assert(s2.overall === "Partially correct", "Scenario 2: Overall is 'Partially correct'");

// Scenario 3: Genuine bill, incorrect date
const s3 = evaluateScanAttempt({ ...baseAttempt, extractedDate: "2025-01-01" });
assert(s3.date === "Incorrect", "Scenario 3: Date is 'Incorrect'");
assert(s3.overall === "Partially correct", "Scenario 3: Overall is 'Partially correct'");

// Scenario 4: Genuine bill, incorrect amount
const s4 = evaluateScanAttempt({ ...baseAttempt, extractedAmount: 999.0 });
assert(s4.amount === "Incorrect", "Scenario 4: Amount is 'Incorrect'");
assert(s4.overall === "Partially correct", "Scenario 4: Overall is 'Partially correct'");

// Scenario 5: Genuine bill, incorrect category
const s5 = evaluateScanAttempt({ ...baseAttempt, extractedCategory: "Transport" });
assert(s5.category === "Incorrect", "Scenario 5: Category is 'Incorrect'");
assert(s5.overall === "Partially correct", "Scenario 5: Overall is 'Partially correct'");

// Scenario 6: Genuine bill rejected as non-bill
const s6 = evaluateScanAttempt({
  ...baseAttempt,
  predictedIsBill: false,
  extractedMerchant: null,
  extractedDate: null,
  extractedAmount: null,
  extractedCategory: null,
  failureStage: "detection",
});
assert(s6.expectedType === "Bill", "Scenario 6: Expected is 'Bill'");
assert(s6.classification === "Incorrect", "Scenario 6: Class is 'Incorrect'");
assert(s6.merchant === "Not extracted", "Scenario 6: Merchant is 'Not extracted'");
assert(s6.date === "Not extracted", "Scenario 6: Date is 'Not extracted'");
assert(s6.amount === "Not extracted", "Scenario 6: Amount is 'Not extracted'");
assert(s6.category === "Not extracted", "Scenario 6: Category is 'Not extracted'");
assert(s6.overall === "Incorrect", "Scenario 6: Overall is 'Incorrect'");

// Scenario 7: Genuine bill with OCR failure
const s7 = evaluateScanAttempt({
  ...baseAttempt,
  predictedIsBill: null,
  ocrStatus: "failed",
  failureStage: "ocr",
  failureReason: "Tesseract OCR timed out",
  extractedMerchant: null,
  extractedDate: null,
  extractedAmount: null,
  extractedCategory: null,
  processingStatus: "failed",
});
assert(s7.expectedType === "Bill", "Scenario 7: Expected is 'Bill'");
assert(s7.classification === "Not evaluated", "Scenario 7: Class is 'Not evaluated'");
assert(s7.merchant === "Not extracted", "Scenario 7: Merchant is 'Not extracted'");
assert(s7.overall === "Incorrect", "Scenario 7: Overall is 'Incorrect'");
assert(s7.action === "Retry scan", "Scenario 7: Action is 'Retry scan'");

// Scenario 8: Non-bill correctly rejected
const nonBillBase = {
  ...baseAttempt,
  imageFileName: "nonbill-01-selfie.png",
  predictedIsBill: false,
  expectedIsBill: false,
  expectedMerchant: null,
  expectedDate: null,
  expectedAmount: null,
  expectedCategory: null,
  extractedMerchant: null,
  extractedDate: null,
  extractedAmount: null,
  extractedCategory: null,
  datasetTag: "nonbill-01-selfie",
};
const s8 = evaluateScanAttempt(nonBillBase);
assert(s8.expectedType === "Non-bill", "Scenario 8: Expected is 'Non-bill'");
assert(s8.classification === "Correct", "Scenario 8: Class is 'Correct'");
assert(s8.merchant === "Not applicable", "Scenario 8: Merchant is 'Not applicable'");
assert(s8.date === "Not applicable", "Scenario 8: Date is 'Not applicable'");
assert(s8.amount === "Not applicable", "Scenario 8: Amount is 'Not applicable'");
assert(s8.category === "Not applicable", "Scenario 8: Category is 'Not applicable'");
assert(s8.overall === "Correct", "Scenario 8: Overall is 'Correct'");
assert(s8.action === "View details", "Scenario 8: Action is 'View details'");

// Scenario 9: Non-bill incorrectly accepted
const s9 = evaluateScanAttempt({ ...nonBillBase, predictedIsBill: true });
assert(s9.classification === "Incorrect", "Scenario 9: Class is 'Incorrect'");
assert(s9.overall === "Incorrect", "Scenario 9: Overall is 'Incorrect'");

// Scenario 10: Record without explicit ground truth defaults to predicted values
const s10 = evaluateScanAttempt({
  ...baseAttempt,
  expectedIsBill: null,
  expectedMerchant: null,
  expectedDate: null,
  expectedAmount: null,
  expectedCategory: null,
});
assert(s10.expectedType === "Bill", "Scenario 10: Expected is 'Bill' (defaulted from predicted)");
assert(s10.classification === "Correct", "Scenario 10: Class is 'Correct' (defaulted from predicted)");
assert(s10.merchant === "Correct", "Scenario 10: Merchant is 'Correct' (defaulted from extracted)");
assert(s10.date === "Correct", "Scenario 10: Date is 'Correct' (defaulted from extracted)");
assert(s10.amount === "Correct", "Scenario 10: Amount is 'Correct' (defaulted from extracted)");
assert(s10.category === "Correct", "Scenario 10: Category is 'Correct' (defaulted from extracted)");
assert(s10.overall === "Correct", "Scenario 10: Overall is 'Correct' (never shows Awaiting GT)");
assert(s10.action === "View details", "Scenario 10: Action is 'View details'");

// Scenario 11: Existing record that previously showed Pending is properly converted
const s11 = evaluateScanAttempt({
  ...baseAttempt,
  expectedIsBill: true,
  expectedMerchant: "Starbucks",
  extractedMerchant: "Starbucks Coffee",
});
assert(s11.merchant === "Correct", "Scenario 11: Normalized comparison matches 'Starbucks Coffee' to 'Starbucks'");
assert(s11.overall === "Correct", "Scenario 11: Successfully computed status without any 'Pending'");

// Scenario 12: Record with partial extraction (only merchant extracted, date and amount missing)
const s12 = evaluateScanAttempt({
  ...baseAttempt,
  extractedDate: null,
  extractedAmount: null,
});
assert(s12.merchant === "Correct", "Scenario 12: Merchant is 'Correct'");
assert(s12.date === "Not extracted", "Scenario 12: Date is 'Not extracted'");
assert(s12.amount === "Not extracted", "Scenario 12: Amount is 'Not extracted'");
assert(s12.category === "Correct", "Scenario 12: Category is 'Correct'");
assert(s12.overall === "Partially correct", "Scenario 12: Overall is 'Partially correct'");

// -----------------------------------------------------------
// TEST GROUP 5: SUMMARY METRICS & DENOMINATORS
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 5: Summary Metrics Denominators ---");

const summary = calculateEvaluationSummary([baseAttempt, nonBillBase, { ...baseAttempt, expectedIsBill: null }]);
assert(summary.totalEvaluated === 3, "Total evaluated = 3");
assert(summary.totalWithGroundTruth === 3, "All 3 records have ground truth (explicit or defaulted from predictions)");
assert(summary.classificationEligibleCount === 3, "Classification denominator is 3");
assert(summary.correctClassifications === 3, "3 correct classifications");
assert(summary.classificationAccuracy === 100, "100% classification accuracy");
assert(summary.merchantEligibleCount === 2, "Merchant denominator is 2 (excludes non-bill)");
assert(summary.merchantCorrectCount === 2, "Merchant correct count is 2");
assert(summary.merchantAccuracy === 100, "100% merchant accuracy");

// -----------------------------------------------------------
// TEST GROUP 6: CSV EXPORT
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 6: CSV Export Verification ---");

const csv = exportEvaluationCsv([baseAttempt, nonBillBase]);
assert(csv.includes("expected_type,expected_is_bill,predicted_is_bill"), "CSV includes expected_type");
assert(csv.includes("overall_status,action_status"), "CSV includes overall_status and action_status");
assert(csv.includes("Not applicable"), "CSV contains Not applicable for non-bill extractions");
assert(!csv.includes("pending"), "CSV does not contain 'pending' anywhere");
assert(!csv.includes("Awaiting ground truth"), "CSV does not contain 'Awaiting ground truth'");
assert(!csv.includes("Missing ground truth"), "CSV does not contain 'Missing ground truth'");

console.log("\n=================================================");
console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} checks passed)`);
console.log("=================================================");
