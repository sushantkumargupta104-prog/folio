import { AppShell } from "@/components/layout/app-shell";
import { ButtonLink } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <AppShell>
      <h1 className="font-serif text-[32px] leading-tight text-ink">You are offline</h1>
      <p className="mt-2 text-[15px] leading-6 text-ink-soft">
        Saved bills on this device can still open. Scanning a new bill needs recognition data that may not be available yet.
      </p>
      <div className="mt-7">
        <ButtonLink href="/">Back to home</ButtonLink>
      </div>
    </AppShell>
  );
}
