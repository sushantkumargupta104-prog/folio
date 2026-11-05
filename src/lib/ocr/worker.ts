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
    workerPromise = createReusableWorker();
  }

  return workerPromise;
}

async function createReusableWorker(): Promise<Worker> {
  try {
    const { createWorker } = await import("tesseract.js");
    return await createWorker("eng", 1, {
      logger: (message) => {
        progressHandler?.(message.status, message.progress);
      },
    });
  } catch {
    workerPromise = null;
    throw new AppError(
      "Folio could not start text recognition. Check your connection and try again. The first scan may need to download recognition data.",
    );
  }
}

export function describeOcrStatus(status: string, progress?: number): {
  label: string;
  progress?: number;
} {
  if (status === "recognizing text") {
    return {
      label: "Reading your bill",
      progress: typeof progress === "number" ? progress : undefined,
    };
  }
  if (status.includes("loading language") || status.includes("initializing api") || status.includes("loaded language")) {
    return {
      label: "Preparing the reader. This may download recognition data the first time.",
    };
  }
  return { label: "Reading your bill" };
}
