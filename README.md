# TCS InvoiceFlow

A personalised invoice workspace by The Code Squad, built with Next.js, React and TypeScript.

## Working now

- Real local signup/sign-in/sign-out, private business onboarding, account/security settings and workspace-scoped documents.
- Persisted client/supplier directories with search, edit, archive/restore and invoice client selection.
- Confirmed-record income, GST, financial-year and report views; private tax-question notebook.
- Responsive TCS landing page, dashboard, invoice library, Brand studio and reminder configuration.
- Fresh invoices with ordered narrative billing sections, explicit amounts, live preview and tax calculations.
- Optional original TCS sample and compatibility with previously saved table drafts.
- Browser-local saving, editing, invoice statuses and reusable branding.
- Browser print / save as PDF, hover effects, preview zoom and reduced-motion support.

The document inbox now supports local PDF/image reading, review, embedded PostgreSQL storage, Australian record classifications and Excel export. See [RECORDS-VAULT.md](RECORDS-VAULT.md) for the verified workflow and limits. Creator drafts remain browser-local. Reminder configuration does not send email; creator reference attachments show names only. Local account signup, sessions, business onboarding and workspace ownership are now implemented. See [ACCOUNTS-WORKSPACES.md](ACCOUNTS-WORKSPACES.md). Public cloud storage and deployment remain future milestones.

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

