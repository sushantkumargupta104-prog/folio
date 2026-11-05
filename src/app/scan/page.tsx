import { Suspense } from "react";
import { ScanView } from "@/components/upload/scan-view";
import { AppShell } from "@/components/layout/app-shell";

export default function ScanPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Scan" backHref="/">
          <p className="text-sm text-ink-muted">Opening the scanner…</p>
        </AppShell>
      }
    >
      <ScanView />
    </Suspense>
  );
}
