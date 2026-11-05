"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { BillRow } from "@/components/bills/bill-row";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { useBills } from "@/hooks/use-bills";
import { filterBills } from "@/lib/db/bill-service";
import { EXPENSE_CATEGORIES, type BillSortKey, type ExpenseCategory } from "@/types/bill";

export function BillsView() {
  const { bills, loading, error } = useBills();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | "all">("all");
  const [sort, setSort] = useState<BillSortKey>("date-desc");

  const visible = useMemo(
    () => filterBills(bills, { query, category, sort }),
    [bills, query, category, sort],
  );

  return (
    <AppShell title="All bills" backHref="/">
      <h1 className="font-serif text-[32px] leading-tight text-ink">Saved bills</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">
        Search, filter and sort bills stored on this device.
      </p>

      <div className="mt-6 space-y-4">
        <Field id="search" label="Search merchant">
          <TextInput
            id="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Merchant name"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="category" label="Category">
            <SelectInput
              id="category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ExpenseCategory | "all")
              }
            >
              <option value="all">All</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field id="sort" label="Sort">
            <SelectInput
              id="sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as BillSortKey)}
            >
              <option value="date-desc">Date, newest</option>
              <option value="date-asc">Date, oldest</option>
              <option value="amount-desc">Amount, high</option>
              <option value="amount-asc">Amount, low</option>
            </SelectInput>
          </Field>
        </div>
      </div>

      {error ? (
        <div className="mt-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <section className="mt-6">
        {loading ? (
          <p className="text-sm text-ink-muted">Loading saved bills…</p>
        ) : visible.length === 0 ? (
          <div className="py-8">
            <h2 className="font-serif text-2xl text-ink">No matching bills</h2>
            <p className="mt-2 text-[15px] text-ink-soft">
              Try another search, or scan a bill to add one.
            </p>
          </div>
        ) : (
          <ul>
            {visible.map((bill) => (
              <li key={bill.id} className="border-b border-line last:border-b-0">
                <BillRow bill={bill} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
