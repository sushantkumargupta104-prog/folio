"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { ReviewForm } from "@/components/review/review-form";
import { getDraft } from "@/lib/db/draft-service";
import type { ScanDraft } from "@/types/bill";
import { toUserMessage } from "@/utils/errors";

export function ReviewView() {
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await getDraft();
        if (!active) return;
        setDraft(next ?? null);
        setLoading(false);
      } catch (loadError) {
        if (!active) return;
        setError(toUserMessage(loadError, "The scanned bill could not be loaded for review."));
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <AppShell title="Review" backHref="/scan">
        <p className="text-sm text-ink-muted">Loading the scanned bill…</p>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Review" backHref="/scan">
        <Notice tone="danger">{error}</Notice>
      </AppShell>
    );
  }

  if (!draft) {
    return (
      <AppShell title="Review" backHref="/scan">
        <h1 className="font-serif text-[32px] leading-tight text-ink">Nothing to review</h1>
        <p className="mt-2 text-[15px] leading-6 text-ink-soft">
          Scan or upload a bill first. Folio will then ask you to check the details.
        </p>
        <div className="mt-6">
          <ButtonLink href="/scan">Scan a bill</ButtonLink>
        </div>
      </AppShell>
    );
  }

  return <ReviewForm draft={draft} />;
}
