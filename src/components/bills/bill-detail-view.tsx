"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/review/confidence-badge";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { useObjectUrl } from "@/hooks/use-object-url";
import { deleteBill, getBillById, updateBill } from "@/lib/db/bill-service";
import { amountToInputValue, parseMoney, sanitizeAmountInput } from "@/lib/extraction/amount-extractor";
import { statusAfterUserEdit } from "@/lib/extraction/confidence";
import { EXPENSE_CATEGORIES, type Bill, type ExpenseCategory } from "@/types/bill";
import { parsedBillAmount, validateBillForm } from "@/lib/validation/bill-schema";
import { formatAmount, formatBillDate, formatSavedAt } from "@/utils/format";
import { toUserMessage } from "@/utils/errors";

export function BillDetailView({ id, justSaved = false }: { id: string; justSaved?: boolean }) {
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [merchantName, setMerchantName] = useState("");
  const [date, setDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const previewUrl = useObjectUrl(bill?.imageBlob);
  const liveStatus = bill
    ? {
        merchantName: statusAfterUserEdit(
          merchantName,
          bill.merchantName,
          bill.fieldReviewStatus.merchantName,
        ),
        date: statusAfterUserEdit(date, bill.date, bill.fieldReviewStatus.date),
        totalAmount:
          totalAmount.trim() === amountToInputValue(bill.totalAmount) ||
          parseMoney(totalAmount) === bill.totalAmount
            ? bill.fieldReviewStatus.totalAmount
            : "user_verified" as const,
        category: statusAfterUserEdit(
          category,
          bill.category,
          bill.fieldReviewStatus.category,
        ),
      }
    : null;

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await getBillById(id);
        if (!active) return;
        if (!next) {
          setError("This bill is no longer available.");
          setLoading(false);
          return;
        }
        setBill(next);
        setMerchantName(next.merchantName);
        setDate(next.date);
        setTotalAmount(amountToInputValue(next.totalAmount));
        setCategory(next.category);
        setLoading(false);
      } catch (loadError) {
        if (!active) return;
        setError(toUserMessage(loadError, "This bill could not be loaded."));
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  async function onSaveEdits() {
    const errors = validateBillForm({ merchantName, date, totalAmount, category });
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0] ?? "Please check the details.");
      return;
    }
    try {
      const original = bill;
      const originalAmount = original ? amountToInputValue(original.totalAmount) : "";
      const amountUnchanged =
        totalAmount.trim() === originalAmount ||
        (original != null && parseMoney(totalAmount) === original.totalAmount);
      await updateBill(id, {
        merchantName,
        date,
        totalAmount: parsedBillAmount(totalAmount),
        category: category as ExpenseCategory,
        fieldReviewStatus: {
          merchantName: statusAfterUserEdit(
            merchantName,
            original?.merchantName,
            original?.fieldReviewStatus.merchantName ?? "user_verified",
          ),
          date: statusAfterUserEdit(
            date,
            original?.date,
            original?.fieldReviewStatus.date ?? "user_verified",
          ),
          totalAmount: amountUnchanged
            ? (original?.fieldReviewStatus.totalAmount ?? "user_verified")
            : "user_verified",
          category: statusAfterUserEdit(
            category,
            original?.category,
            original?.fieldReviewStatus.category ?? "user_verified",
          ),
        },
      });
      const next = await getBillById(id);
      setBill(next ?? null);
      setEditing(false);
      setError(null);
    } catch (saveError) {
      setError(toUserMessage(saveError, "Folio could not update this bill."));
    }
  }

  async function onDelete() {
    try {
      await deleteBill(id);
      router.replace("/bills");
    } catch (deleteError) {
      setError(toUserMessage(deleteError, "Folio could not delete this bill."));
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <AppShell title="Bill" backHref="/">
        <p className="text-sm text-ink-muted">Loading bill…</p>
      </AppShell>
    );
  }

  if (!bill) {
    return (
      <AppShell title="Bill" backHref="/">
        <Notice tone="danger">{error ?? "This bill is no longer available."}</Notice>
      </AppShell>
    );
  }

  return (
    <AppShell title="Bill" backHref="/">
      {justSaved ? (
        <div className="mb-5">
          <Notice tone="ok" title="Bill saved">
            It is stored on this device and will stay after you refresh.
          </Notice>
        </div>
      ) : null}

      <h1 className="font-serif text-[32px] leading-tight text-ink">{bill.merchantName}</h1>
      <p className="mt-2 text-[15px] text-ink-soft">{bill.category}</p>
      <p className="mt-4 text-3xl font-medium tabular-nums">{formatAmount(bill.totalAmount)}</p>
      <p className="mt-2 text-sm text-ink-muted">Saved {formatSavedAt(bill.createdAt)}</p>

      {previewUrl ? (
        <div className="mt-6 overflow-hidden rounded-[10px] border border-line bg-paper-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`Original bill from ${bill.merchantName}`} className="w-full object-contain" />
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      {editing ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSaveEdits();
          }}
        >
          <Field
            id="merchant"
            label="Merchant name"
            badge={<ConfidenceBadge status={liveStatus?.merchantName ?? bill.fieldReviewStatus.merchantName} />}
          >
            <TextInput id="merchant" value={merchantName} onChange={(event) => setMerchantName(event.target.value)} />
          </Field>
          <Field
            id="date"
            label="Bill date"
            badge={<ConfidenceBadge status={liveStatus?.date ?? bill.fieldReviewStatus.date} />}
          >
            <TextInput id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field
            id="amount"
            label="Total amount"
            badge={<ConfidenceBadge status={liveStatus?.totalAmount ?? bill.fieldReviewStatus.totalAmount} />}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-ink-muted">
                ₹
              </span>
              <TextInput
                id="amount"
                className="pl-8"
                inputMode="decimal"
                value={totalAmount}
                onChange={(event) => setTotalAmount(sanitizeAmountInput(event.target.value))}
              />
            </div>
          </Field>
          <Field
            id="category"
            label="Category"
            badge={<ConfidenceBadge status={liveStatus?.category ?? bill.fieldReviewStatus.category} />}
          >
            <SelectInput
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as ExpenseCategory | "")}
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Button type="submit">Save changes</Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <dl className="mt-6 space-y-3 text-[15px]">
          <div className="flex justify-between gap-4 border-b border-line py-3">
            <dt className="flex flex-col gap-1 text-ink-muted">
              Date
              <ConfidenceBadge status={bill.fieldReviewStatus.date} />
            </dt>
            <dd>{formatBillDate(bill.date)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line py-3">
            <dt className="flex flex-col gap-1 text-ink-muted">
              Category
              <ConfidenceBadge status={bill.fieldReviewStatus.category} />
            </dt>
            <dd>{bill.category}</dd>
          </div>
        </dl>
      )}

      {!editing ? (
        <div className="mt-6 space-y-3">
          <Button onClick={() => setEditing(true)}>Edit details</Button>
          {confirmDelete ? (
            <div className="rounded-[10px] border border-[#e3c4bc] bg-[#fbf3f0] p-4">
              <p className="font-medium text-ink">Delete this bill?</p>
              <p className="mt-1 text-sm text-ink-soft">
                This removes the saved details and the original image from this device.
              </p>
              <div className="mt-4 space-y-3">
                <Button variant="danger" onClick={() => void onDelete()}>
                  Delete bill
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Keep bill
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete bill
            </Button>
          )}
        </div>
      ) : null}
    </AppShell>
  );
}
