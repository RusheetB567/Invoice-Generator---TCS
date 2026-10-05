import type { VaultDocument } from "../../../lib/domain/tax-record";
import styles from "../../vault.module.css";
export default function SpreadsheetSource({ document }: { document: VaultDocument }) {
  let cells: string[][] = [];
  try {
    const source: unknown = JSON.parse(document.text);
    if (source && typeof source === "object" && "cells" in source && Array.isArray(source.cells)) cells = source.cells.filter((row): row is string[] => Array.isArray(row) && row.length === 2 && typeof row[0] === "string" && typeof row[1] === "string" && Boolean(row[1])).slice(0, 40);
  } catch { /* Older sources can still be downloaded without a row preview. */ }
  return <div className={styles.spreadsheetSource}><span className={styles.tag}>{document.source?.sheet} · Row {document.source?.row}</span><p className={styles.muted}>Values from the original workbook. Keep the underlying invoice or receipt evidence separately.</p>{cells.length ? <dl className={styles.sourceCells}>{cells.map(([label, value], index) => <div key={index}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <p className={styles.muted}>Download the workbook to review this source row.</p>}</div>;
}
