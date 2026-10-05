"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useWorkspace } from "./workspace-provider";
import ProfileMenu, { profileLinks } from "./profile-menu";
import styles from "./shell.module.css";

const navigation = [
  { href: "/workspace", label: "Dashboard", glyph: "◈" },
  { href: "/invoices", label: "All invoices", glyph: "▤", group: "Invoices" },
  { href: "/create", label: "Create invoice", glyph: "+", group: "Invoices" },
  { href: "/upload", label: "Upload invoice", glyph: "↥", group: "Invoices" },
  { href: "/income", label: "Income", glyph: "↗" },
  { href: "/tax-calculator", label: "Tax calculator", glyph: "%" },
  { href: "/records", label: "Overview", glyph: "◫", group: "Tax" },
  { href: "/tax/gst", label: "GST", glyph: "%", group: "Tax" },
  { href: "/tax/years", label: "Financial years", glyph: "◷", group: "Tax" },
  { href: "/reports", label: "Reports", glyph: "◴" },
];

export default function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const context = useWorkspace();
  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const pointerEnabled = useRef(false);
  const pendingPointer = useRef<{
    x: number;
    y: number;
    surface: HTMLElement | null;
  } | null>(null);
  const sectionLabel =
    (pathname === "/reports/documents" ? "Reports / Documents" : navigation.find((item) => item.href === pathname)?.label) ?? profileLinks.find(item => item.href === pathname)?.label ?? title;
  function navLink({ href, label, glyph }: (typeof navigation)[number]) {
    const active = pathname === href || (href === "/reports" && pathname?.startsWith("/reports/"));
    return (
      <Link
        key={href}
        href={href}
        className={`${styles.navLink} ${active ? styles.active : ""}`}
        aria-current={active ? "page" : undefined}
      >
        <span className={styles.navGlyph} aria-hidden="true">
          {glyph}
        </span>
        {label}
      </Link>
    );
  }

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      pointerEnabled.current = finePointer.matches && !reducedMotion.matches;
      if (!pointerEnabled.current && shell.current)
        shell.current.dataset.pointer = "inactive";
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
    const target =
      event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>("[data-glow]")
        : null;
    pendingPointer.current = {
      x: event.clientX,
      y: event.clientY,
      surface: target,
    };
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
        pointer.surface.style.setProperty(
          "--glow-x",
          `${pointer.x - bounds.left}px`,
        );
        pointer.surface.style.setProperty(
          "--glow-y",
          `${pointer.y - bounds.top}px`,
        );
      }
    });
  }

  function leavePointer() {
    pendingPointer.current = null;
    if (shell.current) shell.current.dataset.pointer = "inactive";
  }

  return (
    <div
      ref={shell}
      className={styles.shell}
      onPointerMove={movePointer}
      onPointerLeave={leavePointer}
    >
      <div className={styles.pointerGlow} aria-hidden="true" />
      <a href="#workspace-content" className={styles.skip}>
        Skip to content
      </a>
      <aside className={styles.sidebar}>
        <Link
          href="/"
          className={styles.wordmark}
          aria-label="The Code Squad InvoiceFlow home"
        >
          <span className={styles.logo} aria-hidden="true">
            {"</>"}
          </span>
          <span>
            <strong>THE CODE SQUAD</strong>
            <small>INVOICEFLOW</small>
          </span>
        </Link>
        <div className={styles.spaceLabel}>
          <span className={styles.statusDot} /> YOUR WORKSPACE{" "}
          <span className={styles.version}>01</span>
        </div>
        <nav className={styles.nav} aria-label="Workspace navigation">
          {navigation.map((item, index) =>
            item.group ? (
              navigation[index - 1]?.group === item.group ? null : (
                <details
                  className={styles.navGroup}
                  key={item.group}
                  open={
                    item.group === "Invoices" ||
                    navigation.some(
                      (link) =>
                        link.group === item.group && link.href === pathname,
                    )
                  }
                >
                  <summary>
                    {item.group}
                    <span aria-hidden="true">⌄</span>
                  </summary>
                  {navigation
                    .filter((link) => link.group === item.group)
                    .map(navLink)}
                </details>
              )
            ) : (
              navLink(item)
            ),
          )}
        </nav>
        <div className={styles.sidebarBottom}>
          <Link href="/" className={styles.backHome}>
            ← Back to platform
          </Link>
          <ProfileMenu />
        </div>
      </aside>
      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <span className={styles.breadcrumb}>
            {context?.workspace.name || "Workspace"} <span>/</span>{" "}
            <strong>{sectionLabel}</strong>
          </span>
          <span className={styles.localTag}>
            <span className={styles.statusDot} /> Private workspace
          </span>
          {pathname !== "/create" && (
            <Link href="/create" className={styles.topAction}>
              + New invoice
            </Link>
          )}
          <ProfileMenu mobile />
        </header>
        <main key={pathname} id="workspace-content" className={styles.content}>
          <div className={styles.pageHeading}>
            <div>
              <span className={styles.eyebrow}>TCS / INVOICEFLOW</span>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          {children}
          <footer className={styles.footer}>
            <span>CRAFTED BY THE CODE SQUAD</span>
            <span>
              Private local workspace · Browser drafts + PostgreSQL records
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
