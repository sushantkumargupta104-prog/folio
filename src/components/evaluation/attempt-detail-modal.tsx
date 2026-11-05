"use client";

import { useMemo, useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/hooks/use-object-url";
import { evaluateScanAttempt } from "@/lib/db/evaluation-service";
import {
  EVALUATION_TEST_DATASET,
  type GroundTruthTemplateItem,
} from "@/lib/evaluation/ground-truth-dataset";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/types/bill";
import type { EvaluationGroundTruth, ScanAttempt } from "@/types/evaluation";
import { formatAmount, formatSavedAt } from "@/utils/format";

interface AttemptDetailModalProps {
  attempt: ScanAttempt;
  initialEditGt?: boolean;
  onClose: () => void;
  onUpdateGroundTruth: (id: string, gt: EvaluationGroundTruth) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function AttemptDetailModal({
  attempt,
  initialEditGt = false,
  onClose,
  onUpdateGroundTruth,
  onDelete,
}: AttemptDetailModalProps) {
  const imageUrl = useObjectUrl(attempt.imageBlob);
  const evaluation = useMemo(() => evaluateScanAttempt(attempt), [attempt]);

  // Ground truth editor state - defaults to predicted/extracted values if not explicitly set
  const defaultIsBill =
    attempt.expectedIsBill !== null
      ? attempt.expectedIsBill
        ? "true"
        : "false"
      : attempt.predictedIsBill === false
        ? "false"
        : "true";

  const [editingGt, setEditingGt] = useState(initialEditGt);
  const [expectedIsBill, setExpectedIsBill] = useState<string>(defaultIsBill);
  const [expectedMerchant, setExpectedMerchant] = useState(
    attempt.expectedMerchant ?? attempt.extractedMerchant ?? "",
  );
  const [expectedDate, setExpectedDate] = useState(
    attempt.expectedDate ?? attempt.extractedDate ?? "",
  );
  const [expectedAmount, setExpectedAmount] = useState(
    attempt.expectedAmount != null
      ? String(attempt.expectedAmount)
      : attempt.extractedAmount != null
        ? String(attempt.extractedAmount)
        : "",
  );
  const [expectedCategory, setExpectedCategory] = useState<ExpenseCategory | "">(
    attempt.expectedCategory ?? (attempt.extractedCategory as ExpenseCategory) ?? "",
  );
  const [datasetTag, setDatasetTag] = useState(attempt.datasetTag ?? "");
  const [notes, setNotes] = useState(attempt.notes ?? "");
  const [savingGt, setSavingGt] = useState(false);

  function applyTemplate(item: GroundTruthTemplateItem) {
    setExpectedIsBill(item.expectedIsBill ? "true" : "false");
    setExpectedMerchant(item.expectedMerchant ?? "");
    setExpectedDate(item.expectedDate ?? "");
    setExpectedAmount(item.expectedAmount != null ? String(item.expectedAmount) : "");
    setExpectedCategory(item.expectedCategory ?? "");
    setDatasetTag(item.datasetTag ?? item.id);
    setNotes(item.notes ?? "");
  }

  async function handleSaveGt() {
    setSavingGt(true);
    try {
      const gt: EvaluationGroundTruth = {
        expectedIsBill:
          expectedIsBill === "" ? null : expectedIsBill === "true",
        expectedMerchant: expectedMerchant.trim() || null,
        expectedDate: expectedDate.trim() || null,
        expectedAmount: expectedAmount.trim() ? Number(expectedAmount) : null,
        expectedCategory: (expectedCategory as ExpenseCategory) || null,
        datasetTag: datasetTag.trim() || null,
        notes: notes.trim() || null,
      };
      await onUpdateGroundTruth(attempt.id, gt);
      setEditingGt(false);
    } finally {
      setSavingGt(false);
    }
  }

  function downloadOriginalImage() {
    if (!attempt.imageBlob) return;
    const url = URL.createObjectURL(attempt.imageBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = attempt.imageFileName || `scan-${attempt.id}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative my-8 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-paper p-6 shadow-2xl text-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="font-serif text-2xl">Scan Evaluation Detail</h2>
            <p className="mt-1 text-xs text-ink-muted">
              ID: {attempt.id} • {formatSavedAt(attempt.createdAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-ink-muted hover:bg-paper-2 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        {/* Image Preview & Details */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            {imageUrl ? (
              <div className="overflow-hidden rounded-lg border border-line bg-paper-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={attempt.imageFileName}
                  className="max-h-60 mx-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-lg border border-line bg-paper-2 text-ink-muted text-sm">
                Image blob not stored
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {attempt.imageFileName} ({Math.round(attempt.imageSize / 1024)} KB)
              </span>
              {attempt.imageBlob ? (
                <button
                  onClick={downloadOriginalImage}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <Download size={14} /> Download Image
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-muted">Status:</span>
              <span className="font-medium capitalize">{attempt.processingStatus}</span>
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-muted">Overall Evaluation:</span>
              <DetailStatusBadge status={evaluation.overall} />
            </div>
            <div className="flex justify-between border-b border-line pb-2">
              <span className="text-ink-muted">Saved to Expenses:</span>
              <span>
                {attempt.isSavedAsBill ? (
                  <span className="text-green-700 font-medium">Yes ({attempt.savedBillId?.slice(0, 8)})</span>
                ) : (
                  <span className="text-ink-muted">No</span>
                )}
              </span>
            </div>
            {attempt.datasetTag ? (
              <div className="flex justify-between border-b border-line pb-2">
                <span className="text-ink-muted">Dataset Tag:</span>
                <span className="font-mono text-xs">{attempt.datasetTag}</span>
              </div>
            ) : null}
            {attempt.failureReason ? (
              <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                <strong>Failure ({attempt.failureStage}):</strong> {attempt.failureReason}
              </div>
            ) : null}
          </div>
        </div>

        {/* Expected vs Predicted Comparison Table */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-serif text-lg">Evaluation Comparison</h3>
            <button
              onClick={() => setEditingGt(!editingGt)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {editingGt ? "Hide Editor" : "Edit Ground Truth"}
            </button>
          </div>

          {editingGt ? (
            <div className="mb-6 rounded-lg border border-line bg-paper-2 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Set Ground Truth</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">Quick Template:</span>
                  <select
                    className="text-xs bg-paper border border-line rounded px-2 py-1"
                    onChange={(e) => {
                      const item = EVALUATION_TEST_DATASET.find((d) => d.id === e.target.value);
                      if (item) applyTemplate(item);
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose 20-image dataset item
                    </option>
                    {EVALUATION_TEST_DATASET.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.id} ({d.imageCategory})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-ink-muted mb-1">Expected Is Bill</label>
                  <select
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={expectedIsBill}
                    onChange={(e) => setExpectedIsBill(e.target.value)}
                  >
                    <option value="true">Bill (Genuine Bill)</option>
                    <option value="false">Non-bill (Non-Bill Image)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-ink-muted mb-1">Dataset Tag</label>
                  <input
                    type="text"
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={datasetTag}
                    onChange={(e) => setDatasetTag(e.target.value)}
                    placeholder="e.g. bill-01-printed"
                  />
                </div>
                <div>
                  <label className="block text-ink-muted mb-1">Expected Merchant</label>
                  <input
                    type="text"
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={expectedMerchant}
                    onChange={(e) => setExpectedMerchant(e.target.value)}
                    placeholder="e.g. Cafe Bloom"
                  />
                </div>
                <div>
                  <label className="block text-ink-muted mb-1">Expected Date</label>
                  <input
                    type="date"
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-ink-muted mb-1">Expected Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={expectedAmount}
                    onChange={(e) => setExpectedAmount(e.target.value)}
                    placeholder="451.50"
                  />
                </div>
                <div>
                  <label className="block text-ink-muted mb-1">Expected Category</label>
                  <select
                    className="w-full bg-paper border border-line rounded px-2.5 py-1.5"
                    value={expectedCategory}
                    onChange={(e) => setExpectedCategory(e.target.value as ExpenseCategory | "")}
                  >
                    <option value="">None</option>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-ink-muted mb-1">Notes</label>
                <input
                  type="text"
                  className="w-full bg-paper border border-line rounded px-2.5 py-1.5 text-xs"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Crumpled receipt test"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEditingGt(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSaveGt()} disabled={savingGt}>
                  {savingGt ? "Saving..." : "Save Ground Truth"}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-paper-2 border-b border-line text-ink-soft">
                <tr>
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3">Expected (Ground Truth)</th>
                  <th className="py-2.5 px-3">Predicted (OCR/Detection)</th>
                  <th className="py-2.5 px-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="py-2.5 px-3 font-medium">Bill Classification</td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium">{evaluation.expectedType}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {attempt.predictedIsBill === null ? (
                      <span className="text-ink-muted">Not evaluated</span>
                    ) : attempt.predictedIsBill ? (
                      `Bill (${Math.round((attempt.billDetectionConfidence ?? 0) * 100)}%)`
                    ) : (
                      "Non-bill"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <DetailStatusBadge status={evaluation.classification} />
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-medium">Merchant</td>
                  <td className="py-2.5 px-3">{attempt.expectedMerchant ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3">{attempt.extractedMerchant ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3 text-right">
                    <DetailStatusBadge status={evaluation.merchant} />
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-medium">Date</td>
                  <td className="py-2.5 px-3">{attempt.expectedDate ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3">{attempt.extractedDate ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3 text-right">
                    <DetailStatusBadge status={evaluation.date} />
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-medium">Amount</td>
                  <td className="py-2.5 px-3">
                    {attempt.expectedAmount != null ? formatAmount(attempt.expectedAmount) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {attempt.extractedAmount != null ? formatAmount(attempt.extractedAmount) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <DetailStatusBadge status={evaluation.amount} />
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-3 font-medium">Category</td>
                  <td className="py-2.5 px-3">{attempt.expectedCategory ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3">{attempt.extractedCategory ?? <span className="text-ink-muted">—</span>}</td>
                  <td className="py-2.5 px-3 text-right">
                    <DetailStatusBadge status={evaluation.category} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Detection Reasons & Warnings */}
        {(attempt.billDetectionReasons?.length || attempt.billDetectionWarnings?.length) ? (
          <section className="mt-6 text-xs space-y-2">
            {attempt.billDetectionReasons?.length ? (
              <div className="rounded-lg bg-green-50/60 border border-green-200/60 p-3">
                <span className="font-semibold text-green-900 block mb-1">Detection Signals:</span>
                <ul className="list-disc list-inside text-green-800 space-y-0.5">
                  {attempt.billDetectionReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {attempt.billDetectionWarnings?.length ? (
              <div className="rounded-lg bg-amber-50/60 border border-amber-200/60 p-3">
                <span className="font-semibold text-amber-900 block mb-1">Negative Indicators & Warnings:</span>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                  {attempt.billDetectionWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* OCR Raw Text Inspection */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              OCR Extracted Text (Confidence: {attempt.ocrConfidence ?? "N/A"}%)
            </h4>
          </div>
          <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-paper-2 p-3 font-mono text-[11px] leading-relaxed text-ink-soft whitespace-pre-wrap">
            {attempt.ocrExtractedText || <span className="text-ink-muted">No text was extracted</span>}
          </div>
        </section>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-between border-t border-line pt-4">
          <button
            onClick={() => {
              if (confirm("Delete this scan attempt record?")) {
                void onDelete(attempt.id);
                onClose();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-medium"
          >
            <Trash2 size={15} /> Delete Record
          </button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Correct":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-800">
          Correct
        </span>
      );
    case "Partially correct":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
          Partially correct
        </span>
      );
    case "Incorrect":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-800">
          Incorrect
        </span>
      );
    case "Not extracted":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800">
          Not extracted
        </span>
      );
    case "Not applicable":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-ink-muted bg-paper-2">
          Not applicable
        </span>
      );
    case "Not evaluated":
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-ink-muted bg-paper-2">
          Not evaluated
        </span>
      );
    default:
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] text-ink-muted bg-paper-2">
          {status}
        </span>
      );
  }
}
