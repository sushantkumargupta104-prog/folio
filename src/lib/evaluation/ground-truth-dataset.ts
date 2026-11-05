import type { EvaluationGroundTruth } from "@/types/evaluation";

export interface GroundTruthTemplateItem extends EvaluationGroundTruth {
  id: string;
  label: string;
  imageCategory: string;
}

export const EVALUATION_TEST_DATASET: GroundTruthTemplateItem[] = [
  {
    id: "bill-01-printed",
    label: "Printed Receipt 1",
    imageCategory: "printed receipt",
    expectedIsBill: true,
    expectedMerchant: "Cafe Bloom",
    expectedDate: "2026-11-04",
    expectedAmount: 451.5,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-01-printed",
    notes: "Clean printed thermal receipt",
  },
  {
    id: "bill-02-printed",
    label: "Printed Receipt 2",
    imageCategory: "printed receipt",
    expectedIsBill: true,
    expectedMerchant: "Starbucks Coffee",
    expectedDate: "2026-10-12",
    expectedAmount: 675.0,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-02-printed",
    notes: "Clean cafe bill",
  },
  {
    id: "bill-03-printed",
    label: "Printed Receipt 3",
    imageCategory: "printed receipt",
    expectedIsBill: true,
    expectedMerchant: "Reliance Fresh",
    expectedDate: "2026-10-18",
    expectedAmount: 1250.0,
    expectedCategory: "Groceries",
    datasetTag: "bill-03-printed",
    notes: "Supermarket line items with tax",
  },
  {
    id: "bill-04-printed",
    label: "Printed Receipt 4",
    imageCategory: "printed receipt",
    expectedIsBill: true,
    expectedMerchant: "Apollo Pharmacy",
    expectedDate: "2026-10-25",
    expectedAmount: 340.5,
    expectedCategory: "Healthcare",
    datasetTag: "bill-04-printed",
    notes: "Medical store receipt",
  },
  {
    id: "bill-05-printed",
    label: "Printed Receipt 5",
    imageCategory: "printed receipt",
    expectedIsBill: true,
    expectedMerchant: "Shell Petrol Pump",
    expectedDate: "2026-10-29",
    expectedAmount: 2000.0,
    expectedCategory: "Transport",
    datasetTag: "bill-05-printed",
    notes: "Fuel station slip",
  },
  {
    id: "bill-06-crumpled",
    label: "Crumpled Receipt 1",
    imageCategory: "crumpled receipt",
    expectedIsBill: true,
    expectedMerchant: "Burger King",
    expectedDate: "2026-10-15",
    expectedAmount: 389.0,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-06-crumpled",
    notes: "Heavily folded receipt with creasing",
  },
  {
    id: "bill-07-crumpled",
    label: "Crumpled Receipt 2",
    imageCategory: "crumpled receipt",
    expectedIsBill: true,
    expectedMerchant: "More Retail Supermarket",
    expectedDate: "2026-10-20",
    expectedAmount: 890.0,
    expectedCategory: "Groceries",
    datasetTag: "bill-07-crumpled",
    notes: "Crumpled grocery paper",
  },
  {
    id: "bill-08-crumpled",
    label: "Crumpled Receipt 3",
    imageCategory: "crumpled receipt",
    expectedIsBill: true,
    expectedMerchant: "Chai Point",
    expectedDate: "2026-11-01",
    expectedAmount: 180.0,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-08-crumpled",
    notes: "Wrinkled tea bill",
  },
  {
    id: "bill-09-blurry",
    label: "Blurry Receipt 1",
    imageCategory: "blurry receipt",
    expectedIsBill: true,
    expectedMerchant: "Subway",
    expectedDate: "2026-10-08",
    expectedAmount: 420.0,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-09-blurry",
    notes: "Slight camera shake and low light",
  },
  {
    id: "bill-10-blurry",
    label: "Blurry Receipt 2",
    imageCategory: "blurry receipt",
    expectedIsBill: true,
    expectedMerchant: "Decathlon Sports",
    expectedDate: "2026-10-22",
    expectedAmount: 1599.0,
    expectedCategory: "Shopping",
    datasetTag: "bill-10-blurry",
    notes: "Out of focus retail bill",
  },
  {
    id: "bill-11-handwritten",
    label: "Handwritten Bill 1",
    imageCategory: "handwritten bill",
    expectedIsBill: true,
    expectedMerchant: "Sri Krishna Store",
    expectedDate: "2026-10-11",
    expectedAmount: 320.0,
    expectedCategory: "Groceries",
    datasetTag: "bill-11-handwritten",
    notes: "Handwritten local kirana bill slip",
  },
  {
    id: "bill-12-handwritten",
    label: "Handwritten Bill 2",
    imageCategory: "handwritten bill",
    expectedIsBill: true,
    expectedMerchant: "Sharma Auto Repairs",
    expectedDate: "2026-10-19",
    expectedAmount: 850.0,
    expectedCategory: "Transport",
    datasetTag: "bill-12-handwritten",
    notes: "Handwritten mechanic service bill",
  },
  {
    id: "bill-13-angled",
    label: "Angled Receipt 1",
    imageCategory: "photograph at an angle",
    expectedIsBill: true,
    expectedMerchant: "Dominos Pizza",
    expectedDate: "2026-10-27",
    expectedAmount: 649.0,
    expectedCategory: "Food & Dining",
    datasetTag: "bill-13-angled",
    notes: "Taken at ~30 degree perspective tilt",
  },
  {
    id: "bill-14-angled",
    label: "Angled Receipt 2",
    imageCategory: "photograph at an angle",
    expectedIsBill: true,
    expectedMerchant: "Croma Electronics",
    expectedDate: "2026-10-30",
    expectedAmount: 2490.0,
    expectedCategory: "Shopping",
    datasetTag: "bill-14-angled",
    notes: "Taken sideways/rotated perspective",
  },
  {
    id: "bill-15-mixed",
    label: "Digital Invoice",
    imageCategory: "digital bill",
    expectedIsBill: true,
    expectedMerchant: "Amazon India",
    expectedDate: "2026-11-02",
    expectedAmount: 1499.0,
    expectedCategory: "Shopping",
    datasetTag: "bill-15-mixed",
    notes: "Clean PDF/screenshot export invoice with columns",
  },
  {
    id: "nonbill-01-selfie",
    label: "Non-Bill 1: Selfie",
    imageCategory: "selfie",
    expectedIsBill: false,
    expectedMerchant: null,
    expectedDate: null,
    expectedAmount: null,
    expectedCategory: null,
    datasetTag: "nonbill-01-selfie",
    notes: "Portrait of person, no financial content",
  },
  {
    id: "nonbill-02-id-card",
    label: "Non-Bill 2: ID Card",
    imageCategory: "id card",
    expectedIsBill: false,
    expectedMerchant: null,
    expectedDate: null,
    expectedAmount: null,
    expectedCategory: null,
    datasetTag: "nonbill-02-id-card",
    notes: "Government Aadhaar or driving license card",
  },
  {
    id: "nonbill-03-screenshot",
    label: "Non-Bill 3: Social Screenshot",
    imageCategory: "screenshot",
    expectedIsBill: false,
    expectedMerchant: null,
    expectedDate: null,
    expectedAmount: null,
    expectedCategory: null,
    datasetTag: "nonbill-03-screenshot",
    notes: "Instagram feed screenshot with comments",
  },
  {
    id: "nonbill-04-photo",
    label: "Non-Bill 4: Photograph",
    imageCategory: "ordinary photograph",
    expectedIsBill: false,
    expectedMerchant: null,
    expectedDate: null,
    expectedAmount: null,
    expectedCategory: null,
    datasetTag: "nonbill-04-photo",
    notes: "Landscape or street photograph",
  },
  {
    id: "nonbill-05-document",
    label: "Non-Bill 5: Document",
    imageCategory: "non-transactional document",
    expectedIsBill: false,
    expectedMerchant: null,
    expectedDate: null,
    expectedAmount: null,
    expectedCategory: null,
    datasetTag: "nonbill-05-document",
    notes: "Book chapter or terms and conditions page",
  },
];

export function findMatchingDatasetItem(
  fileName: string,
): GroundTruthTemplateItem | undefined {
  const normalized = fileName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  for (const item of EVALUATION_TEST_DATASET) {
    const itemIdNorm = item.id.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (normalized.includes(itemIdNorm)) {
      return item;
    }
  }

  // Also check shorthand prefixes like "bill-01" or "bill-1" or "nonbill-01"
  for (const item of EVALUATION_TEST_DATASET) {
    const parts = item.id.split("-");
    if (parts.length >= 2) {
      const prefix = `${parts[0]}-${parts[1]}`;
      if (normalized.includes(prefix)) {
        return item;
      }
      const num = parseInt(parts[1], 10);
      if (!Number.isNaN(num) && normalized.includes(`${parts[0]}-${num}`)) {
        return item;
      }
    }
  }

  return undefined;
}
