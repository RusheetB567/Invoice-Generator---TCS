"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./shell.module.css";

const navigation = [
  { href: "/workspace", label: "Overview", glyph: "◈" },
  { href: "/invoices", label: "Invoices", glyph: "▤" },
  { href: "/create", label: "Create invoice", glyph: "+" },
  { href: "/settings", label: "Brand studio", glyph: "✦" },
  { href: "/reminders", label: "Reminders", glyph: "◷" },
];

export default function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={styles.shell}>
      <a href="#workspace-content" className={styles.skip}>Skip to content</a>
      <aside className={styles.sidebar}>
        <Link href="/" className={styles.wordmark} aria-label="The Code Squad InvoiceFlow home">
          <span className={styles.logo} aria-hidden="true">{"</>"}</span>
          <span><strong>THE CODE SQUAD</strong><small>INVOICEFLOW</small></span>
        </Link>
        <div className={styles.spaceLabel}><span className={styles.statusDot} /> YOUR WORKSPACE <span className={styles.version}>01</span></div>
        <nav className={styles.nav} aria-label="Workspace navigation">
          {navigation.map(({ href, label, glyph }) => <Link key={href} href={href} className={`${styles.navLink} ${pathname === href ? styles.active : ""}`} aria-current={pathname === href ? "page" : undefined}><span className={styles.navGlyph} aria-hidden="true">{glyph}</span>{label}<span className={styles.navArrow} aria-hidden="true">↗</span></Link>)}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.studioCard}><span>YOUR BRAND. YOUR RULES.</span><p>A little more you.<br />A lot less admin.</p><Link href="/settings">Make it yours <span aria-hidden="true">↗</span></Link></div>
          <Link href="/" className={styles.backHome}>← Back to platform</Link>
          <div className={styles.company}><span className={styles.avatar}>TCS</span><span><strong>The Code Squad</strong><small>InvoiceFlow studio</small></span><span className={styles.statusDot} /></div>
        </div>
      </aside>
      <div className={styles.mainArea}>
        <header className={styles.topbar}><span className={styles.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></span><span className={styles.localTag}><span className={styles.statusDot} /> Local preview</span><Link href="/create" className={styles.topAction}>+ New invoice</Link></header>
        <main id="workspace-content" className={styles.content}>
          <div className={styles.pageHeading}><div><span className={styles.eyebrow}>TCS / INVOICEFLOW</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className={styles.headingDecoration} aria-hidden="true">✦</div></div>
          {children}
          <footer className={styles.footer}><span>CRAFTED BY THE CODE SQUAD</span><span>Local browser storage · No cloud sync yet</span></footer>
        </main>
      </div>
    </div>
  );
}
