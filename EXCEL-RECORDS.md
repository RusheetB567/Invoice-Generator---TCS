# Invoice records: Excel import and tax-agent export

The review interface uses white surfaces, pale lavender backgrounds and TCS purple actions across landing, account, workspace, creator, vault and calculator pages. Existing invoice output/print styles remain intact. Forms keep visible keyboard focus, native selectors and reduced-motion support.

## Import

Records → Add records → Import Excel. A blank template is available from the import screen. Standard `.xlsx` files only: 5 MB, 10 worksheets, 40 columns and 1,000 data rows per sheet. Password-protected, macro-enabled, embedded-object and external-workbook-link archives are rejected. Actual decompression is bounded to 25 MB before ExcelJS loads the file; oversized/sparse ranges, DTDs and invalid archives are rejected. No formula or cached formula result becomes an imported field.

Recognised headers match automatically; ambiguous headers need a manual match. The first ten rows are considered for headers. Overview/guide/summary sheets are skipped unless they contain a full invoice-field mapping. Typed dates and zero-padded numeric identifiers are preserved. Australian `dd/mm/yyyy` and ISO date text are accepted; no date is inferred from filenames. Currency is AUD; unsupported values require correction.

The workbook upload creates a private review batch, not financial records. Review shows one row at a time, with amount/date errors and tax selections in a disclosure. Missing GST stays blank, absent business use starts at 0%, and GST credit estimates stay off until explicitly selected. Ready rows can be excluded. Saving requires explicit review confirmation and validates the entire submitted set before an atomic database transaction.

Duplicate identities use supplier/customer, invoice number, invoice date, record type and currency. They are skipped rather than overwriting existing confirmed records. Same-workbook uploads resume the batch. Save retries do not create extra records; partial imports can be resumed from the records page and corrected rows saved later. Unsaved manual row edits remain in the current browser view; only approved records and the original source batch persist.

Each imported record retains its workbook ID, source sheet, row number and original file SHA-256. The original bytes are stored once, with the batch; every row links to that source. The source preview shows original values as escaped text. An imported spreadsheet is not a replacement for underlying invoice/receipt evidence.

## Export

Records → Export for tax agent → filtered, selected or all confirmed records. Unreviewed invoice documents are excluded. One `.xlsx` file contains:

- **Overview:** business name/identifier, export selection/time, record counts and reconciled income/expense/personal totals plus selected GST-credit estimates.
- **Records:** typed Excel dates, numeric AUD amounts, percentage-formatted business use, classifications, notes and original-source references. Invoice identifiers stay text. Text beginning with `=` is exported as text, never a formula.
- **Tax summary:** invoice financial year, record type and category, with counts, document totals, GST shown, business allocation and selected credit estimates. It separates income, expenses and personal records instead of treating their combined total as profit.

This is a tax-agent review pack based on invoice dates, not an ATO upload file, tax return, cash-basis BAS or automatically assessed deduction. Originals are retained separately rather than embedded in the export. Totals use the existing integer-cent allocation engine; summaries do not automatically enable GST claims. Background records remain in PostgreSQL; Excel is an interchange/report format.

Australian record-system context: [ATO — Accounting for GST](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/accounting-for-gst-in-your-business). Export classifications remain the user's review selections. Excel typed values/formatting follow the [ExcelJS API](https://github.com/exceljs/exceljs).

## Engineering and review

Additive `vault_spreadsheet_import` table, created on first use. No existing row or file is deleted. Routes use the existing authenticated workspace/membership guards, same-origin/custom-header write protection and no-store responses. Batch/record/source lookups are scoped to the current workspace. Writes reject viewers. Upload bytes and JSON are bounded. Existing local-only vault restrictions remain; production database/private-storage deployment is still a separate prerequisite for public SaaS release.

Routes: `/records/import`, `/records/import/[id]`, `/api/vault/imports`, `/api/vault/imports/[id]`, `/api/vault/template`; existing `/api/vault/export` and document source route are extended.

Tests cover real authenticated route handlers, private batch access, unapproved uploads, typed identifiers/dates/percentages, formulas, malformed/range/expansion inputs, atomic failures, partial imports/retries, account isolation, original-byte retention, plain source rendering and import/export round trips. Disposable fixtures do not touch user accounts or invoice records.

Verification on 5 October 2026: all 46 main-project tests passed, ESLint passed and the Next.js production build succeeded. Local HTTP checks confirmed the landing route loads and private import pages/APIs reject unauthenticated access. Browser automation remains blocked by the earlier preview policy, so visual/browser interaction review remains outstanding. This verification is not a penetration test or a claim of production certification. No package was added and Git staging/commit/push/sync are left to the user.
