"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useObjectUrl } from "@/hooks/use-object-url";
import { saveDraft } from "@/lib/db/draft-service";
import { processBillImage } from "@/lib/scan/process-bill";
import { validateImageFile } from "@/lib/validation/image-file";
import { toUserMessage } from "@/utils/errors";

type ScanState =
  | { step: "pick" }
  | { step: "preview"; file: File }
  | { step: "processing"; file: File; label: string; progress?: number }
  | { step: "not-bill"; file: File }
  | { step: "uncertain"; file: File };

export function ScanView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source") === "gallery" ? "gallery" : "camera";
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ScanState>({ step: "pick" });
  const [error, setError] = useState<string | null>(null);
  const previewFile = "file" in state ? state.file : null;
  const previewUrl = useObjectUrl(previewFile);

  useEffect(() => {
    if (state.step !== "pick") return;
    const timer = window.setTimeout(() => {
      if (source === "gallery") {
        galleryInputRef.current?.click();
      } else {
        cameraInputRef.current?.click();
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [source, state.step]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      await validateImageFile(file);
      setState({ step: "preview", file });
    } catch (validationError) {
      setError(toUserMessage(validationError, "Please choose a JPEG, PNG or WebP image."));
    }
  }

  async function onContinue() {
    if (state.step !== "preview" && state.step !== "uncertain") return;
    const file = state.file;
    setError(null);
    setState({ step: "processing", file, label: "Preparing your image" });
    try {
      const result = await processBillImage(file, (label, progress) => {
        setState({ step: "processing", file, label, progress });
      });

      if (result.detection.decision === "not_bill") {
        setState({ step: "not-bill", file });
        return;
      }

      await saveDraft({
        imageBlob: file,
        originalOcrText: result.ocr.text,
        meanOcrConfidence: result.ocr.meanConfidence,
        detection: result.detection,
        extraction: result.extraction,
        createdAt: new Date().toISOString(),
      });

      if (result.detection.decision === "uncertain") {
        setState({ step: "uncertain", file });
        return;
      }

      router.push("/review");
    } catch (processError) {
      setError(
        toUserMessage(
          processError,
          "Folio could not read this image. Try another photo with the bill filling the frame.",
        ),
      );
      setState({ step: "preview", file });
    }
  }

  function resetToPick() {
    setError(null);
    setState({ step: "pick" });
  }

  return (
    <AppShell title="Scan" backHref="/">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="Capture bill with camera"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Upload bill from gallery"
        onChange={(event) => {
          void onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {state.step === "pick" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">Add a bill</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            Photograph a receipt or choose one from your gallery. Folio reads it on this device.
          </p>
          {error ? (
            <div className="mt-5">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          <div className="mt-7 space-y-3">
            <Button onClick={() => cameraInputRef.current?.click()}>Scan a bill</Button>
            <Button variant="secondary" onClick={() => galleryInputRef.current?.click()}>
              Upload from gallery
            </Button>
          </div>
          <p className="mt-5 text-sm text-ink-muted">
            Camera capture depends on the browser. Gallery upload is always available.
          </p>
        </>
      ) : null}

      {state.step === "preview" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">Check this image</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            Make sure the full bill is visible, then continue.
          </p>
          {previewUrl ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-line bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Selected bill preview" className="mx-auto max-h-[52vh] object-contain" />
            </div>
          ) : null}
          {error ? (
            <div className="mt-5">
              <Notice tone="danger">{error}</Notice>
            </div>
          ) : null}
          <div className="mt-6 space-y-3">
            <Button onClick={() => void onContinue()}>Continue</Button>
            <Button variant="secondary" onClick={() => cameraInputRef.current?.click()}>
              Retake
            </Button>
            <Button variant="ghost" onClick={() => galleryInputRef.current?.click()}>
              Choose another image
            </Button>
          </div>
        </>
      ) : null}

      {state.step === "processing" ? (
        <div aria-live="polite">
          <h1 className="font-serif text-[32px] leading-tight text-ink">Reading your bill</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            Extracting merchant, date and amount...
          </p>
          <p className="mt-6 text-sm text-ink-muted">{state.label}</p>
          {typeof state.progress === "number" ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div
                className="h-full bg-accent motion-reduce:transition-none"
                style={{ width: `${Math.round(state.progress * 100)}%` }}
              />
            </div>
          ) : (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-paper-2">
              <div className="h-full w-1/3 bg-accent motion-safe:animate-pulse" />
            </div>
          )}
          <p className="mt-5 text-sm text-ink-muted">
            The first scan may download recognition data. Folio does not send your photo to a server.
          </p>
        </div>
      ) : null}

      {state.step === "not-bill" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">
            This doesn&apos;t appear to be a bill.
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            Please upload a receipt, invoice or purchase bill.
          </p>
          <div className="mt-7 space-y-3">
            <Button onClick={resetToPick}>Try another image</Button>
            <Button variant="secondary" onClick={() => router.push("/")}>
              Back to home
            </Button>
          </div>
        </>
      ) : null}

      {state.step === "uncertain" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">We could not be sure</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            This image might be a bill, but the details look incomplete. You can review them or try another photo.
          </p>
          <div className="mt-7 space-y-3">
            <Button onClick={() => router.push("/review")}>Review details anyway</Button>
            <Button variant="secondary" onClick={resetToPick}>
              Try another image
            </Button>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
