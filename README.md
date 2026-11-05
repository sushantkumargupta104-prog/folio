# folio

Your spending, in order.

folio is a mobile-first Progressive Web App for personal expense tracking. Photograph a bill or upload one from your gallery. The app reads the image in the browser, checks whether it looks like a bill, extracts merchant, date, amount and a category suggestion, then saves the record on this device.

No account. No backend. No paid APIs. Photographs never leave the device for processing.

## Features

- Scan with the camera or upload JPEG, PNG and WebP images (up to 15 MB)
- Local OCR with Tesseract.js
- Rule-based bill vs non-bill detection
- Merchant, date, amount and category extraction with review and correction
- Saved bills in IndexedDB via Dexie, including original image blobs
- Search, category filter, and sort on the saved-bills list
- Edit and delete with confirmation
- Installable PWA with an offline application shell

## Technology stack

- Next.js (App Router), React, TypeScript, Tailwind CSS
- Tesseract.js for browser OCR
- Dexie.js for IndexedDB
- Lucide React for icons

## Installation

```bash
npm install
```

## Development commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm start
```

Open `http://localhost:3000`.

## Architecture overview

```
src/
  app/                 screens and metadata
  components/          dashboard, scan, review, bills, layout, ui
  lib/
    db/                Dexie schema and bill/draft services
    ocr/               worker reuse, preprocessing, recognition
    detection/         rule-based bill scoring
    extraction/        merchant, date, amount, category
    validation/        image and bill field checks
    scan/              end-to-end scan pipeline
  hooks/ types/ utils/
```

Scan flow: capture or upload → preview → preprocess a copy of the image → OCR → detection → extraction → review → save to IndexedDB.

## OCR approach

OCR runs entirely in the browser with Tesseract.js. A single worker is created and reused. Large images are resized, contrast-adjusted and converted to grayscale for reading only; the original photo is stored unchanged.

The first scan may download English recognition data. After that, the service worker caches those assets where the browser allows it. folio does not claim full offline OCR until that download has succeeded on the device.

## Bill detection methodology

Detection is a transparent heuristic, not a trained classifier. Recognized text is scored with positive indicators (totals, currency, dates, GST, invoice numbers, line-item language) and negative indicators (identity documents, social UI, sparse text). Scores above a threshold are treated as bills. Low scores are rejected. Mid-range scores are marked uncertain and are not saved silently.

## Known limitations

- Handwritten, crumpled, blurry or steeply angled receipts often need manual correction
- Ambiguous dates (for example 05/06/2026) are flagged for review rather than guessed
- Category is a keyword suggestion, not a guarantee
- Camera capture depends on the mobile browser; gallery upload is always available
- IndexedDB is unavailable in some private browsing modes
- Evaluation on 20 images must be filled in with real uploads using `docs/evaluation-template.csv`

## Evaluation

Use `docs/evaluation-template.csv` while testing 15 real bills and 5 non-bill images. Do not pre-fill results. Record detection, extraction, correctness and notes for each file.
