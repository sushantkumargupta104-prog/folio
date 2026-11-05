"use client";

import { useCallback, useEffect, useState } from "react";
import { getBillCount, getBills, getTotalSpending } from "@/lib/db/bill-service";
import { isIndexedDbAvailable } from "@/lib/db/database";
import { toUserMessage } from "@/utils/errors";
import type { Bill } from "@/types/bill";

interface BillsState {
  bills: Bill[];
  count: number;
  totalSpending: number;
  loading: boolean;
  storageAvailable: boolean;
  error: string | null;
}

export function useBills(): BillsState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<BillsState>({
    bills: [],
    count: 0,
    totalSpending: 0,
    loading: true,
    storageAvailable: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const available = await isIndexedDbAvailable();
      if (!available) {
        setState({
          bills: [],
          count: 0,
          totalSpending: 0,
          loading: false,
          storageAvailable: false,
          error: "This browser cannot save bills locally. Try another browser or turn off private mode.",
        });
        return;
      }

      const [bills, count, totalSpending] = await Promise.all([
        getBills(),
        getBillCount(),
        getTotalSpending(),
      ]);
      setState({
        bills,
        count,
        totalSpending,
        loading: false,
        storageAvailable: true,
        error: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: toUserMessage(error, "Saved bills could not be loaded from this device."),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
