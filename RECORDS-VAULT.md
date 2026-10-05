# Document inbox and Australian records vault

## Working local workflow

The dashboard now exposes Create invoice and Upload invoice. `/upload` accepts one PDF/JPG/PNG at a time, validates its extension, MIME signature, size and image dimensions, and reads it on this computer. Selectable PDF text is extracted directly. Images and scanned PDFs use Tesseract with bundled English language data; invoices are not sent to an external OCR provider.

Upload limits: 10 MB; text PDFs up to 20 pages; scanned-PDF OCR up to 5 pages; images up to 20 megapixels/8,192 pixels per side. Unsupported extraction falls back to manual review with the original retained. Oversized files or page dimensions are rejected. Suggestions are conservative heuristics, not calibrated confidence scores or AI-verified results.

`/upload/:id` shows a rendered original page beside editable suggestions. The user enters missing values, corrects dates/amounts, chooses Income/Expense/Personal, a category, GST treatment and business-use percentage, and explicitly confirms the source. GST credit estimates require an expense, GST registration, GST included and the user's selection. No credit is automatically claimed. Capital assets are categorised without automatically treating them as immediate deductions.

`/records` includes confirmed records only, with separate income/expense totals, selected GST estimates, search, financial-year/type/category filters, card/list views and selection. Category bars are interactive filters based on real records. Unreviewed uploads remain excluded from financial totals and Excel exports.

Excel export contains Overview and Records sheets with typed amounts, preserved invoice numbers, source IDs/hashes, financial years and classification selections. It exports selected records or the currently filtered set. Original documents are kept separately; Excel is an export, not the database. This is an invoice-date organiser, not cash-basis accounting, a lodged BAS or a tax return.

## Persistence and deployment boundary

PGlite provides embedded PostgreSQL for this single-process development milestone. It stores document/review records in JSONB. Private originals are stored separately under `storage/tax-vault/documents`; the database lives under `storage/tax-vault/postgres`. Both are ignored by Git. Back up the complete storage directory while the development server is stopped. Do not open the same PGlite directory from multiple application processes.

The main app and review app use separate storage directories. Test records are not copied into the main app. These routes explicitly refuse production mode and non-localhost requests; mutations also reject cross-origin requests and require the local application header. This local boundary remains, and authenticated membership checks now scope every operation to the current business; see ACCOUNTS-WORKSPACES.md.

Before cloud release, migrate the adapter to managed PostgreSQL, map records into the Prisma business schema, preserve the implemented authenticated membership checks, move originals to private object storage, add audit/version history and background extraction jobs, and test access isolation. The existing creator still saves its drafts in browser storage; this milestone does not silently transfer them.

## Local API

- `GET /api/vault`: list local documents and confirmed records.
- `POST /api/vault`: validate/read/store an original and an unconfirmed candidate.
- `GET /api/vault/:id`: retrieve review data.
- `GET /api/vault/:id?file=1`: retrieve the original.
- `GET /api/vault/:id?preview=1&page=1`: render a PDF page locally.
- `POST /api/vault/:id`: validate and confirm once, in a database transaction.
- `GET /api/vault/export`: export confirmed records using year/query/kind/category and optional selected IDs.

Confirmed records are read-only in this milestone. Corrections/version history, archive, payment dates, foreign currencies, line-item extraction and multi-user access remain planned. No record is automatically deleted or represented as an approved tax deduction.

## Guidance references

Australian record keeping: https://business.gov.au/finance/payments-and-invoicing/record-keeping

GST credit guidance: https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/claiming-gst-credits

PGlite persistence: https://pglite.dev/docs/filesystems

