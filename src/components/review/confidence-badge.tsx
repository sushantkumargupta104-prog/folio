import type { FieldReviewStatus } from "@/types/bill";
import {
  normalizeFieldReviewStatus,
  type VisibleFieldReviewStatus,
} from "@/lib/extraction/confidence";

const LABELS: Record<VisibleFieldReviewStatus, string> = {
  high_confidence: "High confidence",
  needs_review: "Please verify",
  missing: "Not detected",
  user_verified: "User verified",
};

const STYLES: Record<VisibleFieldReviewStatus, string> = {
  high_confidence: "text-ok",
  needs_review: "text-warn",
  missing: "text-ink-muted",
  user_verified: "text-ok",
};

const DOTS: Record<VisibleFieldReviewStatus, string> = {
  high_confidence: "bg-ok",
  needs_review: "bg-warn",
  missing: "bg-ink-muted",
  user_verified: "bg-ok",
};

export function ConfidenceBadge({ status }: { status: FieldReviewStatus }) {
  const normalized = normalizeFieldReviewStatus(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${STYLES[normalized]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[normalized]}`} aria-hidden />
      {LABELS[normalized]}
    </span>
  );
}
