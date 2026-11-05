import { parseMoney } from "@/lib/extraction/amount-extractor";
import { EXPENSE_CATEGORIES, type BillInput, type ExpenseCategory } from "@/types/bill";
import { parseIsoDate } from "@/utils/format";

export interface BillFormValues {
  merchantName: string;
  date: string;
  totalAmount: string;
  category: ExpenseCategory | "";
}

export interface BillFormErrors {
  merchantName?: string;
  date?: string;
  totalAmount?: string;
  category?: string;
}

export function validateBillForm(values: BillFormValues): BillFormErrors {
  const errors: BillFormErrors = {};
  const merchant = values.merchantName.trim();

  if (merchant.length < 2) {
    errors.merchantName = "Enter the merchant name.";
  }

  if (!values.date) {
    errors.date = "Enter the bill date.";
  } else if (!parseIsoDate(values.date)) {
    errors.date = "Enter a valid date.";
  }

  if (!values.totalAmount.trim()) {
    errors.totalAmount = "Enter the total amount.";
  } else if (parseMoney(values.totalAmount) == null) {
    errors.totalAmount = "Enter a valid amount greater than zero.";
  }

  if (!values.category || !EXPENSE_CATEGORIES.includes(values.category)) {
    errors.category = "Choose a category.";
  }

  return errors;
}

export function parsedBillAmount(value: string): number {
  const amount = parseMoney(value);
  if (amount == null) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return amount;
}

export function assertBillInput(input: BillInput): void {
  const errors = validateBillForm({
    merchantName: input.merchantName,
    date: input.date,
    totalAmount: String(input.totalAmount),
    category: input.category,
  });
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors)[0]);
  }
  if (!(input.imageBlob instanceof Blob) || input.imageBlob.size === 0) {
    throw new Error("A bill image is required.");
  }
  if (typeof input.totalAmount !== "number" || !Number.isFinite(input.totalAmount)) {
    throw new Error("Enter a valid amount greater than zero.");
  }
}
