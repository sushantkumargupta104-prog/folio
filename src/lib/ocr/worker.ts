import type { Worker } from "tesseract.js";
import { AppError } from "@/utils/errors";

export type OcrProgressHandler = (status: string, progress?: number) => void;

let workerPromise: Promise<Worker> | null = null;
let progressHandler: OcrProgressHandler | undefined;

export function setOcrProgressHandler(handler?: OcrProgressHandler): void {
  progressHandler = handler;
}

export async function getOcrWorker(): Promise<Worker> {
  if (typeof window === "undefined") {
    throw new AppError("Text reading is only available in the browser.");
  }

  if (!workerPromise) {
    workerPromise = createReusableWorker().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }

  return workerPromise;
}

export function resetOcrWorker(): void {
  if (workerPromise) {
    workerPromise
      .then((worker) => worker.terminate())
      .catch(() => {
        /* ignore termination error */
      });
    workerPromise = null;
  }
}

async function createReusableWorker(): Promise<Worker> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: (message) => {
        progressHandler?.(message.status, message.progress);
      },
    });

    try {
      // PSM 3 (fully automatic) with preserved interword spaces for receipts
      await worker.setParameters({
        preserve_interword_spaces: "1",
      });
    } catch {
      // parameter setting fallback
    }

    return worker;
  } catch (error) {
    workerPromise = null;
    console.error("Failed to start Tesseract worker:", error);
    throw new AppError(
      "Folio could not start text recognition. Check your connection and try again. The first scan may need to download recognition data.",
    );
  }
}

export function describeOcrStatus(
  status: string,
  progress?: number,
): {
  label: string;
  progress?: number;
} {
  if (status === "recognizing text") {
    return {
      label: "Reading text from your bill...",
      progress: typeof progress === "number" ? progress : undefined,
    };
  }
  if (
    status.includes("loading") ||
    status.includes("initializing") ||
    status.includes("loaded")
  ) {
    return {
      label: "Preparing OCR engine. (Downloading models on initial scan...)",
    };
  }
  return { label: "Processing image..." };
}
