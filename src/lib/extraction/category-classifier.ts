import type { ExpenseCategory, ExtractedField } from "@/types/bill";
import { resolveExtractionReview } from "@/lib/extraction/confidence";

const CATEGORY_KEYWORDS: Record<Exclude<ExpenseCategory, "Other">, string[]> = {
  "Food & Dining": [
    "restaurant",
    "cafe",
    "café",
    "coffee",
    "diner",
    "pizza",
    "burger",
    "kitchen",
    "food",
    "meal",
    "dine",
    "bakery",
    "bar",
    "bistro",
    "hotel",
    "swiggy",
    "zomato",
  ],
  Groceries: [
    "grocery",
    "supermarket",
    "mart",
    "kirana",
    "fresh",
    "vegetable",
    "fruit",
    "milk",
    "atta",
    "rice",
    "dmart",
    "reliance fresh",
    "big bazaar",
    "more supermarket",
  ],
  Shopping: [
    "fashion",
    "apparel",
    "boutique",
    "store",
    "mall",
    "amazon",
    "flipkart",
    "myntra",
    "clothing",
    "shoes",
    "electronics",
    "mobile",
    "retail",
  ],
  Utilities: [
    "electric",
    "electricity",
    "water bill",
    "gas",
    "broadband",
    "internet",
    "wifi",
    "recharge",
    "mobile bill",
    "postpaid",
    "utility",
    "bescom",
    "airtel",
    "jio",
  ],
  Transport: [
    "uber",
    "ola",
    "taxi",
    "cab",
    "fuel",
    "petrol",
    "diesel",
    "parking",
    "metro",
    "bus",
    "toll",
    "irctc",
    "flight",
    "airline",
    "rapido",
  ],
  Healthcare: [
    "pharmacy",
    "medical",
    "hospital",
    "clinic",
    "doctor",
    "diagnostic",
    "pathology",
    "apollo",
    "medicine",
    "dental",
  ],
  Entertainment: [
    "movie",
    "cinema",
    "pvr",
    "inox",
    "theatre",
    "theater",
    "netflix",
    "spotify",
    "game",
    "concert",
    "ticket",
  ],
};

export function classifyCategory(
  text: string,
  merchantName: string | null,
): ExtractedField<ExpenseCategory> {
  const haystack = `${merchantName ?? ""} ${text}`.toLowerCase();
  const scores: Array<{ category: ExpenseCategory; hits: number }> = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [Exclude<ExpenseCategory, "Other">, string[]]
  >) {
    const hits = keywords.reduce(
      (count, keyword) => (haystack.includes(keyword) ? count + 1 : count),
      0,
    );
    if (hits > 0) scores.push({ category, hits });
  }

  if (scores.length === 0) {
    const review = resolveExtractionReview({
      hasValue: true,
      extractionReliable: false,
      ocrWordConfidence: null,
    });
    return {
      value: "Other",
      ...review,
      warning: "Category is a suggestion. Change it if needed.",
    };
  }

  scores.sort((a, b) => b.hits - a.hits);
  const best = scores[0];
  const tied = scores.filter((item) => item.hits === best.hits).length > 1;
  const review = resolveExtractionReview({
    hasValue: true,
    extractionReliable: best.hits >= 2 && !tied,
    ambiguous: tied,
    ocrWordConfidence: null,
  });

  return {
    value: best.category,
    ...review,
    warning:
      review.status === "needs_review"
        ? "Category is a suggestion. Change it if needed."
        : undefined,
  };
}
