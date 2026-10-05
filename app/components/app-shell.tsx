"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useWorkspace } from "./workspace-provider";
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
  { href: "/documents", label: "Documents", glyph: "▧" },
  {
    href: "/settings/business",
    label: "Business profile",
    glyph: "◇",
    group: "Settings",
  },
  {
    href: "/settings/account",
    label: "Account",
    glyph: "◎",
    group: "Settings",
  },
  {
    href: "/settings/security",
    label: "Security",
    glyph: "⌘",
    group: "Settings",
  },
  { href: "/settings", label: "Brand studio", glyph: "✦", group: "Settings" },
  { href: "/reminders", label: "Reminders", glyph: "◷", group: "Settings" },
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
  const [signingOut, setSigningOut] = useState(false),
    [signoutError, setSignoutError] = useState("");
  async function signOut() {
    setSigningOut(true);
    setSignoutError("");
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok)
        throw new Error(); /* Full navigation discards private route caches after an authentication or workspace change. */
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sign-in");
    } catch {
      setSignoutError("Unable to sign out. Try again.");
      setSigningOut(false);
    }
  }
  const shell = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const pointerEnabled = useRef(false);
  const pendingPointer = useRef<{
    x: number;
    y: number;
    surface: HTMLElement | null;
  } | null>(null);
  const sectionLabel =
    navigation.find((item) => item.href === pathname)?.label ?? title;
  function navLink({ href, label, glyph }: (typeof navigation)[number]) {
    const active = pathname === href;
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
          <div className={styles.company}>
            <span className={styles.avatar}>
              {context?.user.firstName.slice(0, 1) || "TCS"}
            </span>
            <span>
              <strong>{context?.workspace.name || "The Code Squad"}</strong>
              <small>{context?.user.name || "InvoiceFlow studio"}</small>
            </span>
          </div>
          {context && (
            <button
              type="button"
              className={styles.signout}
              disabled={signingOut}
              onClick={signOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          )}
          {signoutError && <p role="alert">{signoutError}</p>}
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
