export const BILL_ACCEPT_THRESHOLD = 7;
export const BILL_UNCERTAIN_THRESHOLD = 3;

export const POSITIVE_PATTERNS: Array<{
  id: string;
  pattern: RegExp;
  weight: number;
  reason: string;
}> = [
  {
    id: "grand-total",
    pattern: /\b(grand\s*total|amount\s*payable|total\s*due|net\s*payable|balance\s*due)\b/i,
    weight: 4,
    reason: "Found a final payable total label",
  },
  {
    id: "total",
    pattern: /\b(bill\s*amount|net\s*amount|total\s*amount|\btotal\b)\b/i,
    weight: 3,
    reason: "Found a total amount label",
  },
  {
    id: "currency",
    pattern: /₹|\b(?:rs\.?|inr|usd|eur|gbp)\b/i,
    weight: 2,
    reason: "Found currency symbols or abbreviations",
  },
  {
    id: "tax",
    pattern: /\b(gst|cgst|sgst|igst|vat|tax|hst)\b/i,
    weight: 2,
    reason: "Found tax or GST information",
  },
  {
    id: "invoice",
    pattern: /\b(invoice|receipt|bill\s*no|receipt\s*no|inv\.?\s*no|order\s*no|txn)\b/i,
    weight: 2,
    reason: "Found a receipt or invoice number",
  },
  {
    id: "subtotal",
    pattern: /\b(sub\s*total|subtotal)\b/i,
    weight: 1,
    reason: "Found a subtotal",
  },
  {
    id: "qty-price",
    pattern: /\b(qty|quantity|rate|price|item|hrs?)\b/i,
    weight: 1,
    reason: "Found item quantity or price language",
  },
  {
    id: "payment",
    pattern: /\b(cash|card|upi|paid|tendered|change|visa|mastercard|gpay|phonepe)\b/i,
    weight: 1,
    reason: "Found payment method language",
  },
];

export const DATE_HINT =
  /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i;

export const MONEY_HINT = /(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+\.\d{2}/i;

export const NEGATIVE_PATTERNS: Array<{
  id: string;
  pattern: RegExp;
  weight: number;
  reason: string;
}> = [
  {
    id: "id-document",
    pattern:
      /\b(aadhaar|aadhar|passport|pan\s*card|permanent account number|driving\s*licen[cs]e|voter\s*id|election commission)\b/i,
    weight: 8,
    reason: "Looks like a government identity document",
  },
  {
    id: "passport-fields",
    pattern: /\b(surname|given names?|nationality|date of birth|place of birth|passport no)\b/i,
    weight: 6,
    reason: "Contains passport or identity form fields",
  },
  {
    id: "social-ui",
    pattern: /\b(instagram|whatsapp|twitter|facebook|liked by|comments|followers|retweet|story)\b/i,
    weight: 5,
    reason: "Looks like a social media screenshot",
  },
  {
    id: "screenshot-chrome",
    pattern: /\b(wifi|lte|5g\b|search google|notifications?|screenshot)\b/i,
    weight: 2,
    reason: "Contains screenshot or phone UI language",
  },
  {
    id: "long-form-doc",
    pattern: /\b(chapter|abstract|terms of service|privacy policy|curriculum vitae|resume)\b/i,
    weight: 4,
    reason: "Looks like a non-transactional document",
  },
];
