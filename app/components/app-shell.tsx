"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
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
  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const pointerEnabled = useRef(false);
  const pendingPointer = useRef<{ x: number; y: number; surface: HTMLElement | null } | null>(null);
  const sectionLabel = navigation.find(item => item.href === pathname)?.label ?? title;

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      pointerEnabled.current = finePointer.matches && !reducedMotion.matches;
      if (!pointerEnabled.current && shell.current) shell.current.dataset.pointer = "inactive";
    };
    update();
    finePointer.addEventListener("change", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      finePointer.removeEventListener("change", update);
      reducedMotion.removeEventListener("change", update);
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, []);

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    if (!pointerEnabled.current || event.pointerType !== "mouse") return;
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-glow]") : null;
    pendingPointer.current = { x: event.clientX, y: event.clientY, surface: target };
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      const pointer = pendingPointer.current;
      if (!pointer || !shell.current || !pointerEnabled.current) return;
      shell.current.style.setProperty("--pointer-x", `${pointer.x}px`);
      shell.current.style.setProperty("--pointer-y", `${pointer.y}px`);
      shell.current.dataset.pointer = "active";
      if (pointer.surface?.isConnected) {
        const bounds = pointer.surface.getBoundingClientRect();
        pointer.surface.style.setProperty("--glow-x", `${pointer.x - bounds.left}px`);
        pointer.surface.style.setProperty("--glow-y", `${pointer.y - bounds.top}px`);
      }
    });
  }

  function leavePointer() {
    pendingPointer.current = null;
    if (shell.current) shell.current.dataset.pointer = "inactive";
  }

  return (
    <div ref={shell} className={styles.shell} onPointerMove={movePointer} onPointerLeave={leavePointer}>
      <div className={styles.pointerGlow} aria-hidden="true" />
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
          <div className={styles.studioCard} data-glow="true"><span>YOUR BRAND. YOUR RULES.</span><p>A little more you.<br />A lot less admin.</p><Link href="/settings">Make it yours <span aria-hidden="true">↗</span></Link></div>
          <Link href="/" className={styles.backHome}>← Back to platform</Link>
          <div className={styles.company}><span className={styles.avatar}>TCS</span><span><strong>The Code Squad</strong><small>InvoiceFlow studio</small></span><span className={styles.statusDot} /></div>
        </div>
      </aside>
      <div className={styles.mainArea}>
        <header className={styles.topbar}><span className={styles.breadcrumb}>Workspace <span>/</span> <strong>{sectionLabel}</strong></span><span className={styles.localTag}><span className={styles.statusDot} /> Local preview</span>{pathname !== "/create" && <Link href="/create" className={styles.topAction}>+ New invoice</Link>}</header>
        <main key={pathname} id="workspace-content" className={styles.content}>
          <div className={styles.pageHeading}><div><span className={styles.eyebrow}>TCS / INVOICEFLOW</span><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className={styles.headingDecoration} aria-hidden="true">✦</div></div>
          {children}
          <footer className={styles.footer}><span>CRAFTED BY THE CODE SQUAD</span><span>Local browser storage · No cloud sync yet</span></footer>
        </main>
      </div>
    </div>
  );
}
