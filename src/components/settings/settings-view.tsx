"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { deleteAllBills } from "@/lib/db/bill-service";
import { deleteAllScanAttempts } from "@/lib/db/evaluation-service";
import { toUserMessage } from "@/utils/errors";

export function SettingsView() {
  const [confirm, setConfirm] = useState(false);
  const [confirmAttempts, setConfirmAttempts] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clearAll() {
    try {
      await deleteAllBills();
      setMessage("All saved bills have been removed from this device.");
      setConfirm(false);
      setError(null);
    } catch (clearError) {
      setError(toUserMessage(clearError, "Folio could not clear saved bills."));
    }
  }

  async function clearAllAttempts() {
    try {
      await deleteAllScanAttempts();
      setMessage("All scan evaluation records have been cleared from this device.");
      setConfirmAttempts(false);
      setError(null);
    } catch (clearError) {
      setError(toUserMessage(clearError, "Folio could not clear evaluation records."));
    }
  }

  return (
    <AppShell title="Settings" backHref="/">
      <h1 className="font-serif text-[32px] leading-tight text-ink">Settings</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">
        folio keeps your bills on this device. Nothing is sent to a server.
      </p>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-ink-soft">About</h2>
        <p className="text-[15px] leading-6 text-ink-soft">
          Your spending, in order. Photograph a bill, review the details, and save it locally.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-ink-soft">Scan Evaluation & Benchmarking</h2>
        <p className="text-[15px] leading-6 text-ink-soft">
          Inspect all scan attempts, test against the 20-image dataset, and export evaluation CSV reports.
        </p>
        <div className="pt-1">
          <ButtonLink href="/evaluation" variant="secondary">
            Open Evaluation Dashboard
          </ButtonLink>
        </div>
      </section>

      {message ? (
        <div className="mt-6">
          <Notice tone="ok">{message}</Notice>
        </div>
      ) : null}
      {error ? (
        <div className="mt-6">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-medium text-ink-soft">Data on this device</h2>
        <div className="mt-4 space-y-4">
          {confirm ? (
            <div className="rounded-[10px] border border-[#e3c4bc] bg-[#fbf3f0] p-4">
              <p className="font-medium text-ink">Remove every saved bill?</p>
              <p className="mt-1 text-sm text-ink-soft">This cannot be undone.</p>
              <div className="mt-4 space-y-3">
                <Button variant="danger" onClick={() => void clearAll()}>
                  Remove all bills
                </Button>
                <Button variant="secondary" onClick={() => setConfirm(false)}>
                  Keep bills
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Remove all saved bills
              </Button>
            </div>
          )}

          {confirmAttempts ? (
            <div className="rounded-[10px] border border-[#e3c4bc] bg-[#fbf3f0] p-4">
              <p className="font-medium text-ink">Clear all scan evaluation attempts?</p>
              <p className="mt-1 text-sm text-ink-soft">This deletes evaluation records but preserves saved bills.</p>
              <div className="mt-4 space-y-3">
                <Button variant="danger" onClick={() => void clearAllAttempts()}>
                  Clear evaluation records
                </Button>
                <Button variant="secondary" onClick={() => setConfirmAttempts(false)}>
                  Keep records
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button variant="ghost" onClick={() => setConfirmAttempts(true)}>
                Clear evaluation records
              </Button>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
