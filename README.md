# TCS InvoiceFlow

A personalised invoice workspace by The Code Squad, built with Next.js, React and TypeScript.

## Working now

- Responsive TCS landing page, dashboard, invoice library, Brand studio and reminder configuration.
- Fresh invoices with ordered narrative billing sections, explicit amounts, live preview and tax calculations.
- Optional original TCS sample and compatibility with previously saved table drafts.
- Browser-local saving, editing, invoice statuses and reusable branding.
- Browser print / save as PDF, hover effects, preview zoom and reduced-motion support.

Reminder configuration does not send email. Reference attachments show names only. Authentication, database persistence, direct PDF download, uploads, OCR and exports are future milestones. Do not use the current build as a public multi-user financial service.

## Development

Use Node 24 LTS (installed development runtime: 24.19.0).

```powershell
npm ci
npm run dev
npm run lint
npm run test
npm run build
```

The main project uses http://localhost:3000. The review copy uses port 3100. Run only one package installation at a time because the current review copy shares the main project's dependency folder.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [DEVELOPMENT.md](DEVELOPMENT.md), [API.md](API.md), [SECURITY.md](SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md).
