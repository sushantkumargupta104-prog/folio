import { extractDate } from "../src/lib/extraction/date-extractor.ts";
import { extractAmount } from "../src/lib/extraction/amount-extractor.ts";
import { extractMerchant } from "../src/lib/extraction/merchant-extractor.ts";
import { detectBill } from "../src/lib/detection/bill-detection.ts";
import { classifyCategory } from "../src/lib/extraction/category-classifier.ts";

const receipt = `CAFE BLOOM
MG Road
GSTIN 29ABCDE1234F1Z5
Date: 04/11/2026
Cappuccino    180.00
Sandwich      250.00
Subtotal      430.00
GST 5%         21.50
Grand Total   Rs. 451.50
Paid via UPI`;

const ocr = {
  text: receipt,
  words: receipt.split(/\s+/).map((text) => ({ text, confidence: 88 })),
  meanConfidence: 88,
};

const detection = detectBill(ocr);
const merchant = extractMerchant(receipt, 88);
const date = extractDate(receipt, 88);
const amount = extractAmount(receipt, 88);
const category = classifyCategory(receipt, merchant.value);

const checks = [
  detection.decision === "bill",
  merchant.value?.toLowerCase().includes("bloom"),
  date.value === "2026-11-04",
  amount.value === 451.5,
  category.value === "Food & Dining",
];

if (checks.some((ok) => !ok)) {
  console.error({ detection, merchant, date, amount, category });
  process.exit(1);
}

const selfie = detectBill({
  text: "Liked by ananya and others Instagram",
  words: [
    { text: "Liked", confidence: 80 },
    { text: "Instagram", confidence: 80 },
  ],
  meanConfidence: 80,
});

if (selfie.decision === "bill") {
  console.error("false positive", selfie);
  process.exit(1);
}

console.log("smoke-extract ok");
