import Dexie, { type EntityTable } from "dexie";
import type { Bill, ScanDraft } from "@/types/bill";
import type { ScanAttempt } from "@/types/evaluation";

class FolioDatabase extends Dexie {
  bills!: EntityTable<Bill, "id">;
  drafts!: EntityTable<ScanDraft, "id">;
  scanAttempts!: EntityTable<ScanAttempt, "id">;

  constructor() {
    super("folio-db");
    this.version(1).stores({
      bills: "id, date, merchantName, category, createdAt, totalAmount",
      drafts: "id",
    });
    this.version(2).stores({
      bills: "id, date, merchantName, category, createdAt, totalAmount",
      drafts: "id",
      scanAttempts:
        "id, imageId, createdAt, processingStatus, predictedIsBill, failureStage, isSavedAsBill, imageFileName, datasetTag",
    });
  }
}

let database: FolioDatabase | null = null;

export function getDatabase(): FolioDatabase {
  if (typeof window === "undefined") {
    throw new Error("Storage is only available in the browser.");
  }
  if (!database) {
    database = new FolioDatabase();
  }
  return database;
}

export async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.indexedDB) return false;
  try {
    const db = getDatabase();
    await db.open();
    return true;
  } catch {
    return false;
  }
}
