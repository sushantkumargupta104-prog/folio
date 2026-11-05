import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 rounded-md text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label="folio home"
    >
      <ReceiptMark />
      <span className={`lowercase tracking-tight ${compact ? "text-lg" : "text-xl"} font-medium`}>
        folio
      </span>
    </Link>
  );
}

export function ReceiptMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 3.5h10c.6 0 1 .4 1 1V20l-1.4-.8-1.4.8-1.4-.8-1.4.8-1.4-.8-1.4.8-1.4-.8-1.4.8V4.5c0-.6.4-1 1-1Z"
        stroke="#C76845"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M9 8h6M9 11.5h6M9 15h4" stroke="#C76845" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
