"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfidenceBadge } from "@/components/review/confidence-badge";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { useObjectUrl } from "@/hooks/use-object-url";
import { addBill } from "@/lib/db/bill-service";
import { clearDraft } from "@/lib/db/draft-service";
import { amountToInputValue, parseMoney, sanitizeAmountInput } from "@/lib/extraction/amount-extractor";
import { statusAfterUserEdit } from "@/lib/extraction/confidence";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type FieldReviewMap,
  type ScanDraft,
} from "@/types/bill";
import { parsedBillAmount, validateBillForm, type BillFormErrors } from "@/lib/validation/bill-schema";
import { toUserMessage } from "@/utils/errors";

export function ReviewForm({ draft }: { draft: ScanDraft }) {
  const router = useRouter();
  const previewUrl = useObjectUrl(draft.imageBlob);
  const extraction = draft.extraction;

  const [merchantName, setMerchantName] = useState(extraction.merchantName.value ?? "");
  const [date, setDate] = useState(extraction.date.value ?? "");
  const [totalAmount, setTotalAmount] = useState(
    extraction.totalAmount.value != null ? amountToInputValue(extraction.totalAmount.value) : "",
  );
  const [category, setCategory] = useState<ExpenseCategory | "">(
    extraction.category.value ?? "",
  );
  const [errors, setErrors] = useState<BillFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fieldStatus = useMemo<FieldReviewMap>(() => {
    const originalAmount =
      extraction.totalAmount.value != null ? amountToInputValue(extraction.totalAmount.value) : "";
    const amountUnchanged =
      totalAmount.trim() === originalAmount ||
      (extraction.totalAmount.value != null && parseMoney(totalAmount) === extraction.totalAmount.value);

    return {
      merchantName: statusAfterUserEdit(
        merchantName,
        extraction.merchantName.value,
        extraction.merchantName.status,
      ),
      date: statusAfterUserEdit(date, extraction.date.value, extraction.date.status),
      totalAmount: amountUnchanged
        ? statusAfterUserEdit(originalAmount, originalAmount, extraction.totalAmount.status)
        : statusAfterUserEdit(totalAmount, originalAmount, extraction.totalAmount.status),
      category: statusAfterUserEdit(
        category,
        extraction.category.value ?? "",
        extraction.category.status,
      ),
    };
  }, [category, date, extraction, merchantName, totalAmount]);

  async function onSave() {
    const nextErrors = validateBillForm({
      merchantName,
      date,
      totalAmount,
      category,
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const bill = await addBill({
        merchantName: merchantName.trim(),
        date,
        totalAmount: parsedBillAmount(totalAmount),
        category: category as ExpenseCategory,
        imageBlob: draft.imageBlob,
        originalOcrText: draft.originalOcrText,
        detectionConfidence: draft.detection.confidence,
        fieldReviewStatus: fieldStatus,
        originalExtraction: {
          merchantName: extraction.merchantName.value,
          date: extraction.date.value,
          totalAmount: extraction.totalAmount.value,
          category: extraction.category.value,
        },
      });
      await clearDraft();
      router.replace(`/bills/${bill.id}?saved=1`);
    } catch (error) {
      setSaveError(toUserMessage(error, "Folio could not save this bill. Please try again."));
      setSaving(false);
    }
  }

  async function onCancel() {
    await clearDraft();
    router.replace("/");
  }

  return (
    <AppShell title="Review" backHref="/scan">
      <h1 className="font-serif text-[32px] leading-tight text-ink">Review your bill</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">
        Check the details before saving.
      </p>

      {draft.detection.decision === "uncertain" ? (
        <div className="mt-5">
          <Notice tone="warn" title="This may not be a complete bill">
            Please check every field carefully before saving.
          </Notice>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="mt-5 overflow-hidden rounded-[10px] border border-line bg-paper-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Uploaded bill" className="mx-auto max-h-56 object-contain" />
        </div>
      ) : null}

      <form
        className="mt-6 space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave();
        }}
      >
        <Field
          id="merchant"
          label="Merchant name"
          badge={<ConfidenceBadge status={fieldStatus.merchantName} />}
          error={errors.merchantName}
        >
          <TextInput
            id="merchant"
            value={merchantName}
            onChange={(event) => setMerchantName(event.target.value)}
            autoComplete="organization"
          />
        </Field>
        <Field
          id="date"
          label="Bill date"
          badge={<ConfidenceBadge status={fieldStatus.date} />}
          error={errors.date}
        >
          <TextInput
            id="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
        <Field
          id="amount"
          label="Total amount"
          badge={<ConfidenceBadge status={fieldStatus.totalAmount} />}
          error={errors.totalAmount}
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
          badge={<ConfidenceBadge status={fieldStatus.category} />}
          error={errors.category}
        >
          <SelectInput
            id="category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory | "")}
          >
            <option value="">Choose a category</option>
            {EXPENSE_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </Field>

        {saveError ? <Notice tone="danger">{saveError}</Notice> : null}

        <div className="space-y-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save bill"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void onCancel()} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </AppShell>
  );
}
