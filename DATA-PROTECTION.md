# Data protection and compliance preparation

This is an engineering record, not a legal determination or compliance certificate. Hosting, processors, geographic locations, legal operator and privacy contact are pending. The public privacy page accurately reflects that status.

## Information handled
Accounts: names, email, password hashes, verification/reset records and session metadata. Businesses: identity/address/registration/payment instructions. Financial records: customer/supplier information, invoice bodies/totals/tax choices, uploaded originals and extraction text. Security: encrypted MFA material, keyed replay digests, session assurance and minimal audit metadata. Source files may contain sensitive information; the product currently does not support a separate confidential-document permission model.

Only necessary financial fields are rendered/exported for the approved workflow. Audit metadata excludes raw credentials and document bodies. Financial data is not sent to an AI extraction provider in this implementation. Local OCR uses installed libraries. Configured email sends account messages through Resend; private S3 is an optional production adapter. Provider arrangements and subprocessors must be published after selection.

## Australian obligations to assess
Determine whether the Privacy Act applies to the operator; a small-business turnover threshold alone is not conclusive because exceptions exist. Establish an APP collection notice, purpose/use rules, cross-border arrangements, access/correction response process, protected retention and breach procedures if applicable. [OAIC small-business guidance](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/small-business) and [APP guidance](https://www.oaic.gov.au/__data/assets/pdf_file/0019/258121/Consolidated-APP-guidelines.pdf).

Retention must be assessed by record type and applicable obligations. A general five-year tax-record rule has timing conditions and exceptions; it is not an automatic five-year deletion policy. Preserve archived invoice revisions and source evidence until the operator verifies obligations. See [ATO record keeping](https://www.ato.gov.au/api/public/content/0-53cc7a8e-0668-4c9d-95d7-eb841eb09c04).

Requests entered in Account security are pending operator review; no automatic deletion, legal deadline tracking or email response is implied. The administrator download is a bounded summary, not a complete personal-information access response. Production needs a staffed response procedure and secure complete export process.

## Breach handling
Contain compromise, preserve evidence, assess affected accounts/documents and risk of serious harm, then follow the applicable notification process. Under the NDB scheme where applicable, the assessment period is distinct from notification timing; do not treat 30 days as permission to delay notification of an established eligible breach. [OAIC NDB guidance](https://www.oaic.gov.au/privacy/notifiable-data-breaches/preventing-preparing-for-and-responding-to-data-breaches/data-breach-preparation-and-response/part-4-notifiable-data-breach-ndb-scheme).

## Evidence still needed
Approved legal operator/contact and policy; provider/region/subprocessor inventory; private database and storage access evidence; encrypted production backups with tested restore; scanner end-to-end health/blocked-file tests; delivered verification/reset emails; protected logs/alert ownership; retention/legal-hold procedure; full access/correction/deletion workflow; independent penetration test and findings disposition. Essential Eight maturity or OWASP compliance is not claimed from unit tests alone.
