import type { ScanDraft } from "@/types/bill";
import { getDatabase } from "@/lib/db/database";
import { AppError } from "@/utils/errors";

const DRAFT_ID = "current" as const;

export async function saveDraft(draft: Omit<ScanDraft, "id">): Promise<void> {
  try {
    await getDatabase().drafts.put({ ...draft, id: DRAFT_ID });
  } catch {
    throw new AppError("Folio could not keep this scan for review. Please try again.");
  }
}

export async function getDraft(): Promise<ScanDraft | undefined> {
  try {
    return await getDatabase().drafts.get(DRAFT_ID);
  } catch {
    throw new AppError("The scanned bill could not be loaded for review.");
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await getDatabase().drafts.delete(DRAFT_ID);
  } catch {
    throw new AppError("Folio could not clear the unfinished scan.");
  }
}
