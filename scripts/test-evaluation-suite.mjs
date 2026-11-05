import { detectBill } from "../src/lib/detection/bill-detection.ts";
import { extractAmount } from "../src/lib/extraction/amount-extractor.ts";
import { extractDate } from "../src/lib/extraction/date-extractor.ts";
import { extractMerchant } from "../src/lib/extraction/merchant-extractor.ts";
import { classifyCategory } from "../src/lib/extraction/category-classifier.ts";
import {
  calculateEvaluation,
  calculateEvaluationSummary,
  exportEvaluationCsv,
  compareMerchant,
  compareDate,
  compareAmount,
  compareCategory,
} from "../src/lib/db/evaluation-service.ts";
import { EVALUATION_TEST_DATASET } from "../src/lib/evaluation/ground-truth-dataset.ts";

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
// TEST 1: BILL DETECTION - Genuine Bills
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
assert(det1.reasons.some(r => r.includes("payable total") || r.includes("total")), "Identified total label");

// Digital invoice screenshot with phone wifi/battery status
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
assert(det2.decision === "bill", "Digital screenshot invoice recognized as bill despite LTE/status bar text");

// Handwritten receipt slip
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
assert(det3.decision === "bill", "Handwritten bill with basic structure recognized as bill");

// -----------------------------------------------------------
// TEST 2: BILL DETECTION - Non-Bill Images
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 2: Bill Detection (Non-Bills) ---");

const selfieOcr = {
  text: `Liked by priya and 142 others
comments view all 12 comments
send message instagram story`,
  words: [{ text: "Liked", confidence: 85 }],
  meanConfidence: 85,
};
const detNon1 = detectBill(selfieOcr);
assert(detNon1.decision === "not_bill" && detNon1.isBill === false, "Social selfie interface correctly rejected as not_bill");

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
const detNon2 = detectBill(idCardOcr);
assert(detNon2.decision === "not_bill", "Government Aadhaar card rejected as not_bill");

const passportOcr = {
  text: `Republic of India
Passport No: Z1234567
Surname: SHARMA
Given Names: ROHIT
Nationality: INDIAN
Date of Birth: 01/01/1985`,
  words: [{ text: "Passport", confidence: 95 }],
  meanConfidence: 95,
};
const detNon3 = detectBill(passportOcr);
assert(detNon3.decision === "not_bill", "Passport identity document rejected as not_bill");

const documentOcr = {
  text: `Chapter 4: Operating System Structure
Abstract: This document explores process scheduling algorithms and memory management models in modern kernels.
Table of contents and references follow.`,
  words: [{ text: "Chapter", confidence: 90 }],
  meanConfidence: 90,
};
const detNon4 = detectBill(documentOcr);
assert(detNon4.decision === "not_bill", "Academic document text rejected as not_bill");

// -----------------------------------------------------------
// TEST 3: AMOUNT EXTRACTION
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 3: Amount Extraction Reliability ---");

// Test: Rs. prefix with dot (previously was broken)
const amt1 = extractAmount(cleanPrintedOcr);
assert(amt1.value === 451.5, `Correctly extracted 451.5 from "Grand Total Rs. 451.50" (got ${amt1.value})`);

// Test: Indian numbering format with commas
const indianCommaText = `More Retail Supermarket
Items:
Groceries: 890.00
Total Amount: ₹ 1,250.00`;
const amt2 = extractAmount(indianCommaText);
assert(amt2.value === 1250, `Correctly parsed Indian comma format ₹ 1,250.00 (got ${amt2.value})`);

// Test: Subtotal and Cash Tendered competing against Final Total
const competingAmountsText = `Restaurant Bill
Subtotal: 500.00
CGST 2.5%: 12.50
SGST 2.5%: 12.50
Grand Total: 525.00
Cash Tendered: 1000.00
Change Return: 475.00`;
const amt3 = extractAmount(competingAmountsText);
assert(amt3.value === 525, `Prioritized Grand Total 525.00 over Cash Tendered 1000.00 and Subtotal 500.00 (got ${amt3.value})`);

// Test: Date line year is NOT extracted as amount
const dateLineText = `Local Cafe
Date: 04/11/2026
Bill Amount: 350.00`;
const amt4 = extractAmount(dateLineText);
assert(amt4.value === 350, `Did not confuse year 2026 with total amount (got ${amt4.value})`);

// -----------------------------------------------------------
// TEST 4: MERCHANT EXTRACTION
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 4: Merchant Extraction ---");

const m1 = extractMerchant(cleanPrintedOcr);
assert(m1.value?.toLowerCase().includes("bloom"), `Extracted merchant Cafe Bloom (got "${m1.value}")`);
assert(!m1.value?.toLowerCase().includes("road"), "Did not include address line as merchant");

const uppercaseMerchantText = `APOLLO PHARMACY
#45 Richmond Circle
GSTIN: 29AAAAA0000A1Z5
Total: 340.50`;
const m2 = extractMerchant(uppercaseMerchantText);
assert(m2.value?.toLowerCase().includes("apollo pharmacy"), `Extracted Apollo Pharmacy from uppercase header (got "${m2.value}")`);

// -----------------------------------------------------------
// TEST 5: DATE EXTRACTION
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 5: Date Extraction ---");

const d1 = extractDate(cleanPrintedOcr);
assert(d1.value === "2026-11-04", `Extracted 04/11/2026 as ISO 2026-11-04 (got "${d1.value}")`);

const d2 = extractDate("Decathlon Sports\nDate: 22-10-2026\nTotal: 1599");
assert(d2.value === "2026-10-22", `Extracted 22-10-2026 as ISO 2026-10-22 (got "${d2.value}")`);

const d3 = extractDate("Shell Petrol Pump\n29 Oct 2026 14:30\nAmount: 2000.00");
assert(d3.value === "2026-10-29", `Extracted named month "29 Oct 2026" as ISO 2026-10-29 (got "${d3.value}")`);

// -----------------------------------------------------------
// TEST 6: CATEGORY CLASSIFICATION
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 6: Category Classification ---");

const cat1 = classifyCategory("Cafe Bloom Cappuccino Sandwich", "Cafe Bloom");
assert(cat1.value === "Food & Dining", `Classified Cafe as Food & Dining (got "${cat1.value}")`);

const cat2 = classifyCategory("Reliance Fresh Atta Rice Vegetables", "Reliance Fresh");
assert(cat2.value === "Groceries", `Classified Supermarket as Groceries (got "${cat2.value}")`);

const cat3 = classifyCategory("Shell Petrol Fuel Diesel", "Shell Petrol Pump");
assert(cat3.value === "Transport", `Classified Petrol Pump as Transport (got "${cat3.value}")`);

const cat4 = classifyCategory("Apollo Pharmacy Paracetamol Medicine", "Apollo Pharmacy");
assert(cat4.value === "Healthcare", `Classified Apollo Pharmacy as Healthcare (got "${cat4.value}")`);

// -----------------------------------------------------------
// TEST 7: GROUND TRUTH EVALUATION & COMPARISON RULES
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 7: Evaluation Comparison Rules & Denominators ---");

// Case A: Genuine bill, correctly detected and extracted
const attemptA = {
  id: "attempt-1",
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

const evalA = calculateEvaluation(attemptA);
assert(evalA.classification === "correct", "Case A: classification correct");
assert(evalA.merchant === "correct", "Case A: merchant correct");
assert(evalA.date === "correct", "Case A: date correct");
assert(evalA.amount === "correct", "Case A: amount correct");
assert(evalA.category === "correct", "Case A: category correct");
assert(evalA.overall === "passed", "Case A: overall passed");

// Case B: Non-bill correctly rejected
const attemptB = {
  id: "attempt-2",
  imageId: "img-2",
  imageBlob: null,
  imageFileName: "nonbill-01-selfie.png",
  imageType: "image/png",
  imageSize: 85000,
  createdAt: "2026-11-05T10:05:00Z",
  updatedAt: "2026-11-05T10:05:00Z",
  processingStatus: "completed",
  predictedIsBill: false,
  billDetectionConfidence: 0.1,
  billDetectionReasons: [],
  billDetectionWarnings: ["Social media UI"],
  ocrStatus: "success",
  ocrExtractedText: "Liked by others",
  ocrConfidence: 85,
  extractedMerchant: null,
  extractedDate: null,
  extractedAmount: null,
  extractedCategory: null,
  merchantConfidence: null,
  dateConfidence: null,
  amountConfidence: null,
  categoryConfidence: null,
  failureStage: "detection",
  failureReason: "Classified as non-bill",
  errorDetails: null,
  isSavedAsBill: false,
  savedBillId: null,
  expectedIsBill: false,
  expectedMerchant: null,
  expectedDate: null,
  expectedAmount: null,
  expectedCategory: null,
  datasetTag: "nonbill-01-selfie",
  notes: "Selfie non-bill",
};

const evalB = calculateEvaluation(attemptB);
assert(evalB.classification === "correct", "Case B: Non-bill classification is correct");
assert(evalB.merchant === "not_applicable", "Case B: Non-bill merchant is marked not_applicable");
assert(evalB.date === "not_applicable", "Case B: Non-bill date is marked not_applicable");
assert(evalB.amount === "not_applicable", "Case B: Non-bill amount is marked not_applicable");
assert(evalB.overall === "passed", "Case B: Non-bill overall evaluation is passed");

// Case C: Genuine bill incorrectly rejected
const attemptC = {
  ...attemptA,
  id: "attempt-3",
  predictedIsBill: false, // rejected!
  failureStage: "detection",
  failureReason: "Incorrectly classified as non-bill",
  extractedMerchant: null,
};
const evalC = calculateEvaluation(attemptC);
assert(evalC.classification === "incorrect", "Case C: Genuine bill rejected -> classification incorrect");
assert(evalC.merchant === "incorrect", "Case C: Rejected genuine bill -> merchant marked as incorrect (not silently excluded!)");
assert(evalC.overall === "failed", "Case C: Overall failed");

// Summary calculation with honest denominators
const summary = calculateEvaluationSummary([attemptA, attemptB, attemptC]);
assert(summary.totalEvaluated === 3, "Total evaluated = 3");
assert(summary.classificationEligibleCount === 3, "Classification denominator = 3");
assert(summary.correctClassifications === 2, "2 of 3 classifications correct (attemptA and attemptB)");
assert(summary.classificationAccuracy === 66.7, `Classification accuracy = 66.7% (got ${summary.classificationAccuracy})`);

// Crucial: Non-bill (attemptB) MUST NOT be in merchant denominator!
assert(summary.merchantEligibleCount === 2, `Merchant denominator excludes non-bill (expected 2 eligible bills, got ${summary.merchantEligibleCount})`);
assert(summary.merchantCorrectCount === 1, `Merchant correct count = 1 (attemptA correct, attemptC failed, attemptB excluded)`);
assert(summary.merchantAccuracy === 50.0, `Merchant accuracy = 50.0% (got ${summary.merchantAccuracy})`);

// -----------------------------------------------------------
// TEST 8: CSV EXPORT
// -----------------------------------------------------------
console.log("\n--- TEST GROUP 8: CSV Export ---");

const csv = exportEvaluationCsv([attemptA, attemptB, attemptC]);
assert(csv.includes("attempt_id,dataset_tag,file_name"), "CSV contains headers");
assert(csv.includes("bill-01-printed"), "CSV contains bill-01-printed dataset tag");
assert(csv.includes("nonbill-01-selfie"), "CSV contains nonbill-01-selfie dataset tag");
assert(csv.includes("not_applicable"), "CSV contains not_applicable for non-bill extractions");

console.log("\n=================================================");
console.log(`ALL TESTS PASSED! (${passedTests}/${totalTests} checks passed)`);
console.log("=================================================");
