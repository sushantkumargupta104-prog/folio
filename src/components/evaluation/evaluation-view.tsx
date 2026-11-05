"use client";

import { useMemo, useState } from "react";
import { Download, Filter, Trash2, RefreshCw, Eye, Wrench } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { AttemptDetailModal } from "@/components/evaluation/attempt-detail-modal";
import { DatasetRunner } from "@/components/evaluation/dataset-runner";
import { useEvaluation } from "@/hooks/use-evaluation";
import {
  calculateEvaluationSummary,
  evaluateScanAttempt,
  exportEvaluationCsv,
} from "@/lib/db/evaluation-service";
import type {
  ClassificationStatus,
  ExpectedTypeStatus,
  ExtractionStatus,
  OverallStatus,
  ScanAttempt,
} from "@/types/evaluation";
import { formatSavedAt } from "@/utils/format";

type FilterType =
  | "all"
  | "correct_classification"
  | "incorrect_classification"
  | "genuine_bills"
  | "non_bills"
  | "ocr_failures"
  | "extraction_failures";

export function EvaluationView() {
  const {
    attempts,
    loading,
    error,
    refresh,
    repair,
    updateGroundTruth,
    removeAttempt,
    clearAll,
  } = useEvaluation();

  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedAttemptState, setSelectedAttemptState] = useState<{
    attempt: ScanAttempt;
    initialEditGt?: boolean;
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  // Compute summary metrics with honest denominators
  const summary = useMemo(() => calculateEvaluationSummary(attempts), [attempts]);

  // Filter attempts
  const filteredAttempts = useMemo(() => {
    return attempts.filter((attempt) => {
      const evaluation = evaluateScanAttempt(attempt);
      switch (filter) {
        case "correct_classification":
          return evaluation.classification === "Correct";
        case "incorrect_classification":
          return evaluation.classification === "Incorrect";
        case "genuine_bills":
          return (
            attempt.expectedIsBill === true ||
            (attempt.expectedIsBill === null && attempt.predictedIsBill === true)
          );
        case "non_bills":
          return (
            attempt.expectedIsBill === false ||
            (attempt.expectedIsBill === null && attempt.predictedIsBill === false)
          );
        case "ocr_failures":
          return attempt.ocrStatus === "failed" || attempt.failureStage === "ocr";
        case "extraction_failures":
          return (
            evaluation.merchant === "Incorrect" ||
            evaluation.merchant === "Not extracted" ||
            evaluation.date === "Incorrect" ||
            evaluation.date === "Not extracted" ||
            evaluation.amount === "Incorrect" ||
            evaluation.amount === "Not extracted" ||
            evaluation.category === "Incorrect" ||
            evaluation.category === "Not extracted"
          );
        case "all":
        default:
          return true;
      }
    });
  }, [attempts, filter]);

  function handleExportCsv() {
    if (attempts.length === 0) return;
    const csvContent = exportEvaluationCsv(attempts);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `folio-scan-evaluation-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleRepair() {
    setRepairing(true);
    setRepairMsg(null);
    try {
      await repair();
      setRepairMsg("All scan attempt evaluations have been recalculated and repaired.");
    } catch {
      setRepairMsg("Could not complete recalculation.");
    } finally {
      setRepairing(false);
    }
  }

  return (
    <AppShell title="Scan Evaluation" backHref="/">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="font-serif text-[32px] leading-tight text-ink">
            Scan Evaluation & Tracking
          </h1>
          <p className="mt-1 text-[15px] leading-6 text-ink-soft">
            Persistent evaluation records for every scan attempt, failures, and ground truth accuracy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => void handleRepair()}
            disabled={repairing || loading}
            title="Recalculate evaluation statuses for all records"
          >
            <Wrench size={15} /> {repairing ? "Recalculating..." : "Recalculate & Repair"}
          </Button>

          <Button
            variant="secondary"
            onClick={handleExportCsv}
            disabled={attempts.length === 0}
          >
            <Download size={16} /> Export CSV
          </Button>

          <Button variant="ghost" onClick={() => void refresh()}>
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      {repairMsg ? (
        <div className="mt-4">
          <Notice tone="ok">{repairMsg}</Notice>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5">
          <Notice tone="danger">{error}</Notice>
        </div>
      ) : null}

      {/* SUMMARY METRICS CARDS */}
      <section className="mt-6" aria-label="Evaluation Summary Metrics">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted mb-3">
          Summary Metrics (Measurable Benchmarks)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Total Evaluated</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.totalEvaluated}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.totalWithGroundTruth} with ground truth
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Classification Accuracy</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block text-accent">
              {summary.classificationAccuracy !== null
                ? `${summary.classificationAccuracy}%`
                : "—"}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.correctClassifications} / {summary.classificationEligibleCount} correct
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Merchant Accuracy</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.merchantAccuracy !== null ? `${summary.merchantAccuracy}%` : "—"}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.merchantCorrectCount} / {summary.merchantEligibleCount} bills
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Date Accuracy</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.dateAccuracy !== null ? `${summary.dateAccuracy}%` : "—"}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.dateCorrectCount} / {summary.dateEligibleCount} bills
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Amount Accuracy</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.amountAccuracy !== null ? `${summary.amountAccuracy}%` : "—"}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.amountCorrectCount} / {summary.amountEligibleCount} bills
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Category Accuracy</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.categoryAccuracy !== null ? `${summary.categoryAccuracy}%` : "—"}
            </span>
            <span className="text-[11px] text-ink-muted">
              {summary.categoryCorrectCount} / {summary.categoryEligibleCount} bills
            </span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">OCR Failures</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block text-red-700">
              {summary.ocrFailureCount}
            </span>
            <span className="text-[11px] text-ink-muted">failed text recognition</span>
          </div>

          <div className="rounded-lg border border-line bg-paper-2 p-3.5">
            <span className="text-xs text-ink-muted block">Non-Bill Rejections</span>
            <span className="text-2xl font-semibold tabular-nums mt-1 block">
              {summary.billDetectionRejections}
            </span>
            <span className="text-[11px] text-ink-muted">detected as non-bills</span>
          </div>
        </div>
      </section>

      {/* 20-IMAGE TEST DATASET RUNNER */}
      <section className="mt-8">
        <DatasetRunner
          existingAttempts={attempts}
          onComplete={refresh}
        />
      </section>

      {/* FILTER BAR */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Filter size={14} />
            <span>Filter Attempts:</span>
          </div>

          {attempts.length > 0 && (
            <div>
              {confirmClear ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete all records?</span>
                  <button
                    onClick={() => {
                      void clearAll();
                      setConfirmClear(false);
                    }}
                    className="text-xs font-semibold text-red-700 hover:underline"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-xs text-ink-muted hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-ink-muted hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 size={13} /> Clear Attempts
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: "all", label: `All (${attempts.length})` },
            { id: "correct_classification", label: "Correctly Classified" },
            { id: "incorrect_classification", label: "Incorrectly Classified" },
            { id: "genuine_bills", label: "Genuine Bills" },
            { id: "non_bills", label: "Non-Bills" },
            { id: "ocr_failures", label: "OCR Failures" },
            { id: "extraction_failures", label: "Extraction Failures" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterType)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                filter === tab.id
                  ? "bg-accent text-white"
                  : "bg-paper-2 text-ink-soft hover:bg-paper-2/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* ATTEMPTS TABLE */}
      <section className="mt-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-muted">Loading evaluation records...</p>
        ) : filteredAttempts.length === 0 ? (
          <div className="rounded-xl border border-line bg-paper-2 p-8 text-center">
            <h3 className="font-serif text-lg text-ink">No Scan Attempts Found</h3>
            <p className="mt-1 text-xs text-ink-muted max-w-sm mx-auto">
              Scan images using the application or upload test files in the dataset runner above. Every attempt is persisted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-2 border-b border-line text-ink-soft">
                <tr>
                  <th className="py-2.5 px-3">Scan / File</th>
                  <th className="py-2.5 px-3">Expected</th>
                  <th className="py-2.5 px-3">Predicted</th>
                  <th className="py-2.5 px-3">Class.</th>
                  <th className="py-2.5 px-3">Merchant</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-center">Overall</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredAttempts.map((attempt) => {
                  const evalResult = evaluateScanAttempt(attempt);
                  return (
                    <tr
                      key={attempt.id}
                      onClick={() =>
                        setSelectedAttemptState({
                          attempt,
                          initialEditGt: false,
                        })
                      }
                      className="hover:bg-paper-2/50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3">
                        <div className="font-medium text-ink truncate max-w-[140px]">
                          {attempt.imageFileName}
                        </div>
                        <div className="text-[10px] text-ink-muted font-mono">
                          {attempt.datasetTag ?? formatSavedAt(attempt.createdAt)}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <ExpectedBadge status={evalResult.expectedType} />
                      </td>

                      <td className="py-3 px-3 text-ink-soft">
                        {attempt.predictedIsBill === null ? (
                          <span className="text-ink-muted">Unknown</span>
                        ) : attempt.predictedIsBill ? (
                          "Bill"
                        ) : (
                          "Non-bill"
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={evalResult.classification} />
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={evalResult.merchant} />
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={evalResult.date} />
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={evalResult.amount} />
                      </td>

                      <td className="py-3 px-3">
                        <StatusBadge status={evalResult.category} />
                      </td>

                      <td className="py-3 px-3 text-center">
                        <OverallBadge status={evalResult.overall} />
                      </td>

                      <td className="py-3 px-3 text-right">
                        {evalResult.action === "Retry scan" ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttemptState({
                                attempt,
                                initialEditGt: false,
                              });
                            }}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-red-100 text-red-800 hover:bg-red-200 font-medium transition-colors"
                          >
                            Retry
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAttemptState({
                                attempt,
                                initialEditGt: false,
                              });
                            }}
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-medium"
                          >
                            <Eye size={13} /> View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DETAIL MODAL */}
      {selectedAttemptState ? (
        <AttemptDetailModal
          attempt={selectedAttemptState.attempt}
          initialEditGt={selectedAttemptState.initialEditGt}
          onClose={() => setSelectedAttemptState(null)}
          onUpdateGroundTruth={async (id, gt) => {
            await updateGroundTruth(id, gt);
            const updated = attempts.find((a) => a.id === id);
            if (updated) {
              setSelectedAttemptState({
                attempt: { ...updated, ...gt },
                initialEditGt: false,
              });
            }
          }}
          onDelete={async (id) => {
            await removeAttempt(id);
            setSelectedAttemptState(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ExpectedBadge({ status }: { status: ExpectedTypeStatus }) {
  switch (status) {
    case "Bill":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
          Bill
        </span>
      );
    case "Non-bill":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-800">
          Non-bill
        </span>
      );
    default:
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
          Bill
        </span>
      );
  }
}

function StatusBadge({
  status,
}: {
  status: ClassificationStatus | ExtractionStatus | string;
}) {
  switch (status) {
    case "Correct":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
          Correct
        </span>
      );
    case "Incorrect":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
          Incorrect
        </span>
      );
    case "Not extracted":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-800">
          Not extracted
        </span>
      );
    case "Not applicable":
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] text-ink-muted bg-paper-2">
          N/A
        </span>
      );
    case "Not evaluated":
    default:
      return (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] text-ink-muted bg-paper-2">
          Not evaluated
        </span>
      );
  }
}

function OverallBadge({ status }: { status: OverallStatus }) {
  switch (status) {
    case "Correct":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-800">
          CORRECT
        </span>
      );
    case "Partially correct":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800">
          PARTIAL
        </span>
      );
    case "Incorrect":
    default:
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800">
          INCORRECT
        </span>
      );
  }
}
