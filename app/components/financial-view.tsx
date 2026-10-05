"use client";
import Link from "next/link";
import { useState } from "react";
import AppShell from "./app-shell";
import ReportTabs from "./report-tabs";
import { money } from "./money";
import { useVault } from "../../lib/use-vault";
import { allocations, financialYear } from "../../lib/domain/tax-record";
import { hundredths } from "../../lib/domain/invoice-math";
import styles from "../vault.module.css";
export default function FinancialView({
  mode,
}: {
  mode: "income" | "reports" | "gst" | "years";
}) {
  const { documents, loading, error } = useVault();
  const [year, setYear] = useState("");
  const all = documents.filter((document) => document.record),
    years = [
      ...new Set(all.map((document) => financialYear(document.record!.issued))),
    ]
      .sort()
      .reverse();
  const records = all.filter(
    (document) => !year || financialYear(document.record!.issued) === year,
  );
  const income = records.filter(
      (document) => document.record!.kind === "Income",
    ),
    expenses = records.filter(
      (document) => document.record!.kind === "Expense",
    );
  const total = (values: typeof records, field: "total" | "gst") =>
    values.reduce(
      (sum, document) =>
        sum + hundredths(document.record![field], BigInt(9999999))!,
      BigInt(0),
    );
  const credit = expenses.reduce(
    (sum, document) => sum + allocations(document.record!).credit,
    BigInt(0),
  );
  const titles = {
    income: "Income, with context.",
    reports: "Your records tell a story.",
    gst: "GST, clearly organised.",
    years: "Every financial year, in focus.",
  };
  const metrics =
    mode === "gst"
      ? ([
          ["GST recorded on income", total(income, "gst")],
          ["GST recorded on expenses", total(expenses, "gst")],
          ["Selected credit estimate", credit],
        ] as const)
      : ([
          ["Recorded income invoices", total(income, "total")],
          ["Recorded expense invoices", total(expenses, "total")],
          [
            "Invoice total difference",
            total(income, "total") - total(expenses, "total"),
          ],
        ] as const);
  const groups = new Map<
    string,
    { income: bigint; expense: bigint; count: number }
  >();
  for (const document of records) {
    const record = document.record!;
    if (record.kind === "Personal") continue;
    const key =
      mode === "years"
        ? financialYear(record.issued)
        : record.issued.slice(0, 7);
    const group = groups.get(key) || {
      income: BigInt(0),
      expense: BigInt(0),
      count: 0,
    };
    group.count++;
    group[record.kind === "Income" ? "income" : "expense"] += hundredths(
      record.total,
      BigInt(9999999),
    )!;
    groups.set(key, group);
  }
  return (
    <AppShell
      title={titles[mode]}
      subtitle="Views calculated from confirmed uploaded records belonging to this business."
    >
      {mode === "reports" ? <ReportTabs selected="reports" /> : mode !== "income" ? <Link href="/reports/documents" target="_blank" rel="noopener noreferrer" className={styles.documentAccess}>Documents in Reports <span aria-hidden="true">↗</span><span className={styles.srOnly}> (opens in a new tab)</span></Link> : null}
      <div className={styles.titleRow}>
        <label>
          Financial year{" "}
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All financial years</option>
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Link
          className={styles.secondary}
          href={`/api/vault/export?year=${encodeURIComponent(year)}`}
        >
          Export Excel ↗
        </Link>
      </div>
      <div className={styles.flow}>
        {metrics.map(([label, value]) => (
          <article key={label} className={styles.panel} data-glow="true">
            <span className={styles.eyebrow}>{label}</span>
            <h2>{loading || error ? "—" : money(value, "AUD")}</h2>
          </article>
        ))}
      </div>
      <p className={styles.footnote}>
        Invoice-date view in AUD. These are recorded invoice totals, not cash
        receipts, recognised revenue, a lodged BAS, or a tax liability. Drafts
        from the creator are excluded. Selected GST credits are estimates based
        on your review choices.
      </p>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading your records…</p>
      ) : error ? null : records.length ? (
        mode === "income" ? (
          <div className={styles.recordGrid}>
            {income.map((document) => (
              <article
                className={styles.record}
                key={document.id}
                data-glow="true"
              >
                <h2>{document.record!.supplier}</h2>
                <p>
                  {document.record!.number} · {document.record!.issued}
                </p>
                <strong className={styles.recordAmount}>
                  {money(
                    hundredths(document.record!.total, BigInt(9999999))!,
                    "AUD",
                  )}
                </strong>
                <Link
                  className={styles.textLink}
                  href={`/upload/${document.id}`}
                >
                  View reviewed source ↗
                </Link>
              </article>
            ))}
            {!income.length && <p>No income records in this selection.</p>}
          </div>
        ) : (
          <section className={styles.panel}>
            <h2>
              {mode === "years"
                ? "Australian financial years"
                : "Monthly record totals"}
            </h2>
            <div className={styles.recordGrid}>
              {[...groups]
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([label, group]) => (
                  <article
                    className={styles.record}
                    key={label}
                    data-glow="true"
                  >
                    <h3>{label}</h3>
                    <p>{group.count} records</p>
                    <p>Income: {money(group.income, "AUD")}</p>
                    <p>Expenses: {money(group.expense, "AUD")}</p>
                  </article>
                ))}
            </div>
          </section>
        )
      ) : (
        <section className={styles.panel}>
          <h2>Your real numbers will appear here.</h2>
          <p>
            Upload an invoice, review its fields and tax treatment, then confirm
            the record.
          </p>
          <Link href="/upload" className={styles.primary}>
            Upload an invoice ↥
          </Link>
        </section>
      )}
    </AppShell>
  );
}
