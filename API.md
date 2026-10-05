# API organisation

There are no authenticated business APIs yet. Local browser storage is the current persistence implementation.

Planned route handlers are thin adapters around validated services:

- `/api/auth/*`: auth library handlers.
- `/api/businesses/:businessId`: profile and membership-authorised settings.
- `/api/businesses/:businessId/contacts`: client/supplier records.
- `/api/businesses/:businessId/invoices`: issued/received invoice CRUD and revisions.
- `/api/businesses/:businessId/invoices/:invoiceId/payments`: transaction-safe payment records.
- `/api/businesses/:businessId/documents`: upload metadata and authorised retrieval.
- `/api/businesses/:businessId/documents/:documentId/review`: extraction candidate/review/confirmation.
- Export/report endpoints follow after confirmed financial records exist.

Each route obtains a server session, verifies membership, validates input, calls a service and returns a safe response. Use 401 for missing session, 404 for inaccessible resources, 422 for invalid inputs and 409 for revision/number conflicts. Never leak another business's existence through error messages.

Serialize monetary integers as decimal strings in JSON. Use ISO date-only strings for billing dates, UTC timestamps for events. Never accept client totals as authoritative. Avoid returning object storage paths or raw provider errors.
