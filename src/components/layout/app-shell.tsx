import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { Settings } from "lucide-react";
import Link from "next/link";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  backHref?: string;
  showSettings?: boolean;
}

export function AppShell({
  children,
  title,
  backHref,
  showSettings = false,
}: AppShellProps) {
  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))] md:max-w-[560px]">
        <header className="mb-7 flex items-center justify-between gap-3">
          {backHref ? (
            <Link
              href={backHref}
              className="rounded-md text-sm text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Back
            </Link>
          ) : (
            <BrandMark />
          )}
          {title ? (
            <p className="text-sm font-medium text-ink-soft">{title}</p>
          ) : showSettings ? (
            <Link
              href="/settings"
              aria-label="Settings"
              className="rounded-md p-2 text-ink-soft hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Settings size={20} strokeWidth={1.7} />
            </Link>
          ) : (
            <span className="w-8" />
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
