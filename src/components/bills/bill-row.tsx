"use client";

import Link from "next/link";
import { useObjectUrl } from "@/hooks/use-object-url";
import { formatAmount, formatBillDate } from "@/utils/format";
import type { Bill } from "@/types/bill";

export function BillRow({ bill }: { bill: Bill }) {
  const thumbnail = useObjectUrl(bill.imageBlob);

  return (
    <Link
      href={`/bills/${bill.id}`}
      className="flex items-center gap-3 rounded-[10px] py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[8px] border border-line bg-paper-2">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{bill.merchantName}</p>
        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {formatBillDate(bill.date)} · {bill.category}
        </p>
      </div>
      <p className="shrink-0 text-[15px] font-medium tabular-nums text-ink">
        {formatAmount(bill.totalAmount)}
      </p>
    </Link>
  );
}
