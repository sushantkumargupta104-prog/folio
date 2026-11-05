"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteAllScanAttempts,
  deleteScanAttempt,
  getScanAttempts,
  setAttemptGroundTruth,
} from "@/lib/db/evaluation-service";
import type { EvaluationGroundTruth, ScanAttempt } from "@/types/evaluation";

export function useEvaluation() {
  const [attempts, setAttempts] = useState<ScanAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getScanAttempts();
      setAttempts(data);
      setLoading(false);
    } catch {
      setError("Failed to load scan evaluation records.");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getScanAttempts()
      .then((data) => {
        if (!active) return;
        setAttempts(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("Failed to load scan evaluation records.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updateGroundTruth = useCallback(
    async (id: string, gt: EvaluationGroundTruth) => {
      await setAttemptGroundTruth(id, gt);
      await refresh();
    },
    [refresh],
  );

  const removeAttempt = useCallback(
    async (id: string) => {
      await deleteScanAttempt(id);
      await refresh();
    },
    [refresh],
  );

  const clearAll = useCallback(async () => {
    await deleteAllScanAttempts();
    await refresh();
  }, [refresh]);

  return {
    attempts,
    loading,
    error,
    refresh,
    updateGroundTruth,
    removeAttempt,
    clearAll,
  };
}
