# Private records vault
Authenticated workspace users can upload PDF/JPG/PNG and standard XLSX. Request-byte limits, actual file signatures and image dimensions are validated. Original bytes are stored before parsing, malware-scanned when configured, and integrity-checked during private downloads. A failed scanner blocks access and extraction. Development without a scanner is explicitly local validation only.

PDF text extraction and local OCR propose fields; they do not prove supplier identity or GST eligibility. Users review/correct records and choose tax treatment before confirmation. Confirmed records are immutable in the current UI. Changes require a future reviewed correction workflow; originals are never automatically deleted.

XLSX review preserves row/source provenance, typed dates, identifiers and conservative tax defaults; formulas, macros, suspicious XML and excessive ZIP expansion are rejected. Reviewed rows commit atomically, with duplicate/resume protection and audit events. Original workbooks remain separate evidence; imported rows do not replace underlying invoice evidence.

Excel exports include confirmed records only, exact amounts, source IDs and financial-year/classification summaries. Administrator export permission and recent authenticator verification are required. Uploaded record reports are invoice-date summaries, not cash accounting, a lodged BAS or a tax return.

Originals are available through authenticated scoped routes. No permanent public links exist. Local storage and synthetic tests are working; live PostgreSQL/S3/scanner integration and production retention/backup policy remain pending.

