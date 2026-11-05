"use client";

import Link from "next/link";
import { Camera, Images, ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { BillRow } from "@/components/bills/bill-row";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useBills } from "@/hooks/use-bills";
import { formatAmount } from "@/utils/format";

export function DashboardView() {
  const { bills, count, totalSpending, loading, error, storageAvailable } = useBills();
  const recent = bills.slice(0, 8);

  return (
    <AppShell showSettings>
      <p className="text-sm text-ink-muted">Your spending, in order.</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight text-ink">Your expenses</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-6 text-ink-soft">
        Keep track of your spending, one bill at a time.
      </p>

      <section className="mt-6 flex gap-8 border-y border-line py-4" aria-label="Summary">
        <div>
          <p className="text-sm text-ink-muted">Saved bills</p>
          <p className="mt-1 text-xl font-medium tabular-nums">{loading ? "—" : count}</p>
        </div>
        <div>
          <p className="text-sm text-ink-muted">Recorded spending</p>
          <p className="mt-1 text-xl font-medium tabular-nums">
            {loading ? "—" : formatAmount(totalSpending)}
          </p>
        </div>
      </section>

      {error ? (
        <div className="mt-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      {!storageAvailable ? (
        <div className="mt-5">
          <Notice tone="warn" title="Local saving is unavailable">
            Folio stores bills only on this device. Private browsing or a blocked database can prevent saving.
          </Notice>
        </div>
      ) : null}

      <div className="mt-7 space-y-3">
        <ButtonLink href="/scan?source=camera">
          <Camera size={18} strokeWidth={1.8} />
          Scan a bill
        </ButtonLink>
        <ButtonLink href="/scan?source=gallery" variant="secondary">
          <Images size={18} strokeWidth={1.8} />
          Upload from gallery
        </ButtonLink>
      </div>

      <div className="mt-4">
        <Link
          href="/evaluation"
          className="flex items-center justify-between rounded-lg border border-line bg-paper-2 px-3.5 py-2.5 text-xs text-ink-soft hover:text-ink hover:border-accent/40 transition-colors"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <ClipboardCheck size={15} className="text-accent" /> Scan Evaluation & History
          </span>
          <span className="text-accent">View all attempts →</span>
        </Link>
      </div>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="recent-heading" className="text-sm font-medium text-ink-soft">
            Recent bills
          </h2>
          {bills.length > 0 ? (
            <Link
              href="/bills"
              className="text-sm text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              View all
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3 py-4" aria-label="Loading bills">
            <div className="h-12 rounded-[8px] bg-paper-2" />
            <div className="h-12 rounded-[8px] bg-paper-2" />
          </div>
        ) : bills.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {recent.map((bill) => (
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
