"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useObjectUrl } from "@/hooks/use-object-url";
import { saveDraft } from "@/lib/db/draft-service";
import {
  createScanAttempt,
  markAttemptCancelled,
} from "@/lib/db/evaluation-service";
import { processBillImage } from "@/lib/scan/process-bill";
import { validateImageFile } from "@/lib/validation/image-file";
import type { ScanAttempt } from "@/types/evaluation";
import { toUserMessage } from "@/utils/errors";

type ScanState =
  | { step: "pick" }
  | { step: "preview"; file: File }
  | {
      step: "processing";
      file: File;
      label: string;
      progress?: number;
      attemptId: string;
    }
  | { step: "ocr-failed"; file: File; attemptId: string; message: string }
  | { step: "not-bill"; file: File; attemptId: string }
  | { step: "uncertain"; file: File; attemptId: string };

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

    // Create persistent Scan Attempt record immediately as processing begins
    let attempt: ScanAttempt;
    try {
      attempt = await createScanAttempt({
        imageFile: file,
        imageFileName: file.name,
      });
    } catch (recordError) {
      console.error("Failed to create scan record:", recordError);
      setError("Could not initialize scan attempt recording.");
      return;
    }

    setState({
      step: "processing",
      file,
      label: "Preparing your image...",
      attemptId: attempt.id,
    });

    try {
      const result = await processBillImage(file, {
        attemptId: attempt.id,
        onStatus: (label, progress) => {
          setState({ step: "processing", file, label, progress, attemptId: attempt.id });
        },
      });

      // Save draft with the attemptId so review & save can link them
      await saveDraft({
        imageBlob: file,
        originalOcrText: result.ocr.text,
        meanOcrConfidence: result.ocr.meanConfidence,
        detection: result.detection,
        extraction: result.extraction,
        createdAt: new Date().toISOString(),
        scanAttemptId: attempt.id,
      });

      if (result.detection.decision === "not_bill") {
        setState({ step: "not-bill", file, attemptId: attempt.id });
        return;
      }

      if (result.detection.decision === "uncertain") {
        setState({ step: "uncertain", file, attemptId: attempt.id });
        return;
      }

      router.push("/review");
    } catch (processError) {
      const msg = toUserMessage(
        processError,
        "We couldn't read enough text from this image. Try a clearer, well-lit photo or enter the details manually.",
      );
      setState({ step: "ocr-failed", file, attemptId: attempt.id, message: msg });
    }
  }

  async function onManualEntryFromFailure() {
    if (state.step !== "ocr-failed" && state.step !== "not-bill") return;
    const { file, attemptId } = state;

    // Create an empty draft allowing manual review
    await saveDraft({
      imageBlob: file,
      originalOcrText: "",
      meanOcrConfidence: 0,
      detection: {
        isBill: true,
        confidence: 0.5,
        score: 0,
        reasons: ["Manual entry initiated by user"],
        warnings: ["OCR failed or skipped"],
        decision: "uncertain",
      },
      extraction: {
        merchantName: {
          value: null,
          confidence: 0,
          ocrConfidence: null,
          reliability: "not_detected",
          status: "missing",
        },
        date: {
          value: null,
          confidence: 0,
          ocrConfidence: null,
          reliability: "not_detected",
          status: "missing",
        },
        totalAmount: {
          value: null,
          confidence: 0,
          ocrConfidence: null,
          reliability: "not_detected",
          status: "missing",
        },
        category: {
          value: "Other",
          confidence: 0,
          ocrConfidence: null,
          reliability: "not_detected",
          status: "needs_review",
        },
      },
      createdAt: new Date().toISOString(),
      scanAttemptId: attemptId,
    });

    router.push("/review");
  }

  function resetToPick() {
    if ("attemptId" in state && state.attemptId) {
      void markAttemptCancelled(state.attemptId);
    }
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
              <img
                src={previewUrl}
                alt="Selected bill preview"
                className="mx-auto max-h-[52vh] object-contain"
              />
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
            The first scan may download recognition data. Folio never sends your photo to a server.
          </p>
        </div>
      ) : null}

      {state.step === "ocr-failed" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">Could not read text</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            {state.message}
          </p>
          {previewUrl ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-line bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected bill preview"
                className="mx-auto max-h-[40vh] object-contain"
              />
            </div>
          ) : null}
          <div className="mt-6 space-y-3">
            <Button onClick={() => void onManualEntryFromFailure()}>
              Enter details manually
            </Button>
            <Button variant="secondary" onClick={resetToPick}>
              Try another image
            </Button>
          </div>
        </>
      ) : null}

      {state.step === "not-bill" ? (
        <>
          <h1 className="font-serif text-[32px] leading-tight text-ink">
            This doesn&apos;t appear to be a bill
          </h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            We checked the image and couldn&apos;t detect receipt or invoice information. Non-bills are recorded in your scan evaluations and not saved to your expenses.
          </p>
          {previewUrl ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-line bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected bill preview"
                className="mx-auto max-h-[40vh] object-contain"
              />
            </div>
          ) : null}
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
          <h1 className="font-serif text-[32px] leading-tight text-ink">We&apos;re not sure this is a bill</h1>
          <p className="mt-2 text-[15px] leading-6 text-ink-soft">
            This image might be a bill, but the details look incomplete or blurry. You can retry with a clearer image or continue to review.
          </p>
          {previewUrl ? (
            <div className="mt-5 overflow-hidden rounded-[10px] border border-line bg-paper-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected bill preview"
                className="mx-auto max-h-[40vh] object-contain"
              />
            </div>
          ) : null}
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
