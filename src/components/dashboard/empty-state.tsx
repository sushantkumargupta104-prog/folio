import { ButtonLink } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="py-8">
      <h2 className="font-serif text-2xl text-ink">No bills saved yet</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-6 text-ink-soft">
        Scan your first bill to get started.
      </p>
      <div className="mt-5">
        <ButtonLink href="/scan?source=camera">Scan a bill</ButtonLink>
      </div>
    </div>
  );
}
