"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { deleteAllBills } from "@/lib/db/bill-service";
import { toUserMessage } from "@/utils/errors";

export function SettingsView() {
  const [confirm, setConfirm] = useState(false);
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
        {confirm ? (
          <div className="mt-4 rounded-[10px] border border-[#e3c4bc] bg-[#fbf3f0] p-4">
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
          <div className="mt-4">
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Remove all bills
            </Button>
          </div>
        )}
      </section>
    </AppShell>
  );
}
