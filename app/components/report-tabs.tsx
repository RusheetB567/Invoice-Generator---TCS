import Link from "next/link";
import styles from "../vault.module.css";
export default function ReportTabs({ selected }: { selected: "reports" | "documents" }) {
  return <nav className={styles.reportTabs} aria-label="Reports views"><Link href="/reports" aria-current={selected === "reports" ? "page" : undefined}>Reports</Link><Link href="/reports/documents" aria-current={selected === "documents" ? "page" : undefined}>Documents</Link></nav>;
}
