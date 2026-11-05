export const BILL_ACCEPT_THRESHOLD = 6;
export const BILL_UNCERTAIN_THRESHOLD = 2;

export interface DetectionRule {
  id: string;
  pattern: RegExp;
  weight: number;
  reason: string;
}

export const POSITIVE_PATTERNS: DetectionRule[] = [
  {
    id: "grand-total",
    pattern:
      /\b(grand\s*total|amount\s*payable|amt\.?\s*payable|total\s*due|net\s*payable|balance\s*due|net\s*amount|bill\s*amount|total\s*amount)\b/i,
    weight: 4,
    reason: "Found a final payable total label",
  },
  {
    id: "total-label",
    pattern: /\b(total|tot\b|final\s*bill)\b/i,
    weight: 2,
    reason: "Found a total label",
  },
  {
    id: "tax-gst",
    pattern:
      /\b(gstin|gst|cgst|sgst|igst|vat|tax\s*invoice|sales\s*tax|service\s*tax|hsn|sac\s*code)\b/i,
    weight: 3,
    reason: "Found tax or GST information",
  },
  {
    id: "invoice-receipt",
    pattern:
      /\b(tax\s*invoice|invoice|receipt|cash\s*memo|bill\s*no|receipt\s*no|inv\.?\s*no|order\s*#|order\s*no|txn\s*id|transaction\s*id|token\s*no)\b/i,
    weight: 3,
    reason: "Found receipt, invoice or transaction identifier",
  },
  {
    id: "currency",
    pattern: /₹|\b(?:rs\.?|inr|usd|\$|eur|gbp)\b/i,
    weight: 2,
    reason: "Found currency symbols or abbreviations",
  },
  {
    id: "items-qty-rate",
    pattern:
      /\b(qty|quantity|rate|mrp|price|subtotal|sub\s*total|discount|disc\.?|round\s*off|pcs\b|nos\b)\b/i,
    weight: 2,
    reason: "Found line-item, quantity or price structure",
  },
  {
    id: "payment-method",
    pattern:
      /\b(cash|card|upi|paid|tendered|change|visa|mastercard|gpay|phonepe|paytm|bhim|pos|debit|credit)\b/i,
    weight: 2,
    reason: "Found payment method or tender information",
  },
  {
    id: "business-indicators",
    pattern:
      /\b(pvt\.?\s*ltd|supermarket|hypermarket|store|mart|cafe|restaurant|bakers|bakery|kitchen|pharmacy|fuels?|petrol|hospital|clinic)\b/i,
    weight: 2,
    reason: "Found retail or business establishment indicators",
  },
];

export const DATE_HINT =
  /\b(?:\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})\b/i;

export const MONEY_HINT =
  /(?:₹|rs\.?|inr)?\s*\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})|\b\d+\.\d{2}\b/i;

export const NEGATIVE_PATTERNS: DetectionRule[] = [
  {
    id: "id-document",
    pattern:
      /\b(aadhaar|aadhar|passport|pan\s*card|permanent\s*account\s*number|driving\s*licen[cs]e|voter\s*id|election\s*commission|unique\s*identification\s*authority|republic\s*of\s*india)\b/i,
    weight: 10,
    reason: "Matches identity or government document keywords",
  },
  {
    id: "passport-fields",
    pattern:
      /\b(surname|given\s*names?|nationality|date\s*of\s*birth|place\s*of\s*birth|passport\s*no|father's\s*name|holder's\s*signature)\b/i,
    weight: 8,
    reason: "Contains personal identity form fields",
  },
  {
    id: "social-ui",
    pattern:
      /\b(liked\s*by|comments|followers|following|retweet|repost|view\s*all\s*\d+\s*comments|direct\s*message|add\s*a\s*comment|send\s*message|instagram|tiktok|facebook)\b/i,
    weight: 8,
    reason: "Matches social media application interface text",
  },
  {
    id: "non-transaction-doc",
    pattern:
      /\b(curriculum\s*vitae|resume|abstract|chapter\s*\d|terms\s*of\s*service|privacy\s*policy|table\s*of\s*contents|affidavit|agreement\s*between|memorandum\s*of\s*understanding)\b/i,
    weight: 7,
    reason: "Matches non-transactional document structure",
  },
];
