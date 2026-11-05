"use client";

import { useRef, useState } from "react";
import { RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { createScanAttempt } from "@/lib/db/evaluation-service";
import {
  EVALUATION_TEST_DATASET,
  findMatchingDatasetItem,
  type GroundTruthTemplateItem,
} from "@/lib/evaluation/ground-truth-dataset";
import { processBillImage } from "@/lib/scan/process-bill";
import type { ScanAttempt } from "@/types/evaluation";

interface DatasetRunnerProps {
  existingAttempts: ScanAttempt[];
  onComplete: () => Promise<void>;
}

export function DatasetRunner({ existingAttempts, onComplete }: DatasetRunnerProps) {
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const singleSlotInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<GroundTruthTemplateItem | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Map of datasetTag -> latest scan attempt
  const attemptsByTag = new Map<string, ScanAttempt>();
  for (const attempt of existingAttempts) {
    if (attempt.datasetTag && !attemptsByTag.has(attempt.datasetTag)) {
      attemptsByTag.set(attempt.datasetTag, attempt);
    }
  }

  // Handle single file upload for a specific slot
  async function handleSingleSlotFile(file: File | undefined) {
    if (!file || !activeSlot) return;
    setErrorMsg(null);
    setIsRunning(true);
    setProgressMsg(`Processing ${activeSlot.label} (${file.name})...`);
    setProgressPercent(10);

    try {
      await runSingleItem(file, activeSlot, (msg, pct) => {
        setProgressMsg(msg);
        if (pct) setProgressPercent(pct);
      });
      await onComplete();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Processing failed");
    } finally {
      setIsRunning(false);
      setProgressMsg(null);
      setActiveSlot(null);
    }
  }

  // Handle batch file upload (multiple files selected at once)
  async function handleBatchFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setIsRunning(true);

    const fileList = Array.from(files);
    let completedCount = 0;

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const matchedGt =
          findMatchingDatasetItem(file.name) ||
          EVALUATION_TEST_DATASET.find((d) => file.name.toLowerCase().includes(d.id));

        const targetSlot =
          matchedGt ||
          EVALUATION_TEST_DATASET[i % EVALUATION_TEST_DATASET.length];

        setProgressMsg(
          `[${i + 1}/${fileList.length}] Processing ${file.name} as ${targetSlot.id}...`,
        );
        setProgressPercent(Math.round(((i) / fileList.length) * 100));

        await runSingleItem(file, targetSlot);
        completedCount++;
      }

      await onComplete();
    } catch (err) {
      setErrorMsg(`Batch error after ${completedCount} items: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setIsRunning(false);
      setProgressMsg(null);
      setProgressPercent(100);
    }
  }

  // Helper to run pipeline on a single image and record with ground truth
  async function runSingleItem(
    imageBlob: Blob | File,
    slot: GroundTruthTemplateItem,
    onStatus?: (msg: string, pct?: number) => void,
  ) {
    const attempt = await createScanAttempt({
      imageFile: imageBlob,
      imageFileName: imageBlob instanceof File ? imageBlob.name : `${slot.id}.png`,
      groundTruth: slot,
    });

    try {
      await processBillImage(imageBlob, {
        attemptId: attempt.id,
        onStatus: (label, progress) => {
          onStatus?.(label, typeof progress === "number" ? Math.round(progress * 100) : undefined);
        },
      });
    } catch (err) {
      console.warn(`Scan error on ${slot.id}:`, err);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-paper-2 p-5 mb-8">
      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void handleBatchFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <input
        ref={singleSlotInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void handleSingleSlotFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-serif text-xl">20-Image Assignment Test Dataset</h2>
          <p className="mt-1 text-xs text-ink-muted">
            15 genuine bills (printed, crumpled, blurry, handwritten, angled, digital) and 5 non-bills.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => batchFileInputRef.current?.click()}
            disabled={isRunning}
          >
            <Upload size={16} /> Batch Upload Test Images
          </Button>
        </div>
      </div>

      {isRunning ? (
        <div className="mt-4 rounded-lg border border-accent/30 bg-paper p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <RefreshCw size={16} className="animate-spin" />
            <span>{progressMsg || "Processing dataset..."}</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-paper-2">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {errorMsg ? (
        <div className="mt-4">
          <Notice tone="danger">{errorMsg}</Notice>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {EVALUATION_TEST_DATASET.map((slot) => {
          const recorded = attemptsByTag.get(slot.id);
          const hasRun = recorded !== undefined;
          const isPassed =
            hasRun &&
            recorded.predictedIsBill === slot.expectedIsBill &&
            recorded.processingStatus === "completed";

          return (
            <div
              key={slot.id}
              className={`rounded-lg border p-3 flex flex-col justify-between ${
                hasRun
                  ? isPassed
                    ? "border-green-200 bg-green-50/50"
                    : "border-amber-200 bg-amber-50/50"
                  : "border-line bg-paper"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] text-ink-muted">{slot.id}</span>
                  {hasRun ? (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        isPassed ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {recorded.predictedIsBill ? "Bill" : "Non-bill"}
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-muted">Untested</span>
                  )}
                </div>

                <p className="mt-1.5 font-medium text-ink">{slot.label}</p>
                <p className="text-[11px] text-ink-soft">
                  {slot.expectedIsBill ? `₹${slot.expectedAmount ?? "—"} • ${slot.expectedMerchant ?? "—"}` : "Non-bill"}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-line/60 flex items-center justify-between">
                <span className="text-[10px] text-ink-muted capitalize">
                  {slot.imageCategory}
                </span>
                <button
                  onClick={() => {
                    setActiveSlot(slot);
                    singleSlotInputRef.current?.click();
                  }}
                  disabled={isRunning}
                  className="text-xs text-accent font-medium hover:underline flex items-center gap-1"
                >
                  <Upload size={12} /> {hasRun ? "Rerun" : "Upload"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
