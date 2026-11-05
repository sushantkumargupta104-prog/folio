import type { Bill, BillInput, BillSortKey, ExpenseCategory } from "@/types/bill";
import { getDatabase } from "@/lib/db/database";
import { assertBillInput } from "@/lib/validation/bill-schema";
import { AppError } from "@/utils/errors";
import { createId } from "@/utils/id";

export async function addBill(input: BillInput): Promise<Bill> {
  try {
    assertBillInput(input);
    const now = new Date().toISOString();
    const bill: Bill = {
      ...input,
      merchantName: input.merchantName.trim(),
      id: createId(),
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().bills.add(bill);
    return bill;
  } catch (error) {
    throw new AppError(
      error instanceof Error && error.message.startsWith("Enter")
        ? error.message
        : "Folio could not save this bill. Please try again.",
    );
  }
}

export async function getBills(): Promise<Bill[]> {
  try {
    return await getDatabase().bills.orderBy("createdAt").reverse().toArray();
  } catch {
    throw new AppError("Saved bills could not be loaded from this device.");
  }
}

export async function getBillById(id: string): Promise<Bill | undefined> {
  try {
    return await getDatabase().bills.get(id);
  } catch {
    throw new AppError("This bill could not be loaded.");
  }
}

export async function updateBill(
  id: string,
  updates: Partial<
    Pick<Bill, "merchantName" | "date" | "totalAmount" | "category" | "fieldReviewStatus" | "originalExtraction">
  >,
): Promise<void> {
  try {
    const existing = await getDatabase().bills.get(id);
    if (!existing) {
      throw new AppError("This bill is no longer available.");
    }
    const next: Bill = {
      ...existing,
      ...updates,
      merchantName: (updates.merchantName ?? existing.merchantName).trim(),
      updatedAt: new Date().toISOString(),
    };
    assertBillInput(next);
    await getDatabase().bills.put(next);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("Folio could not update this bill.");
  }
}

export async function deleteBill(id: string): Promise<void> {
  try {
    const existing = await getDatabase().bills.get(id);
    if (!existing) return;
    await getDatabase().bills.delete(id);
  } catch {
    throw new AppError("Folio could not delete this bill.");
  }
}

export async function getTotalSpending(): Promise<number> {
  const bills = await getBills();
  return bills.reduce((sum, bill) => sum + bill.totalAmount, 0);
}

export async function getBillCount(): Promise<number> {
  try {
    return await getDatabase().bills.count();
  } catch {
    throw new AppError("Saved bills could not be loaded from this device.");
  }
}

export async function deleteAllBills(): Promise<void> {
  try {
    await getDatabase().bills.clear();
  } catch {
    throw new AppError("Folio could not clear saved bills.");
  }
}

export function filterBills(
  bills: Bill[],
  options: {
    query: string;
    category: ExpenseCategory | "all";
    sort: BillSortKey;
  },
): Bill[] {
  const query = options.query.trim().toLowerCase();
  const filtered = bills.filter((bill) => {
    const matchesQuery = !query || bill.merchantName.toLowerCase().includes(query);
    const matchesCategory =
      options.category === "all" || bill.category === options.category;
    return matchesQuery && matchesCategory;
  });

  filtered.sort((a, b) => {
    switch (options.sort) {
      case "date-asc":
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      case "amount-desc":
        return b.totalAmount - a.totalAmount;
      case "amount-asc":
        return a.totalAmount - b.totalAmount;
      case "date-desc":
      default:
        return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    }
  });

  return filtered;
}
