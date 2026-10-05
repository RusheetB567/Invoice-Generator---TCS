"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { useTheme } from "./theme-provider";
import styles from "./shell.module.css";
export const profileLinks = [
  { href: "/settings/business", label: "Business profile" },
  { href: "/settings/account", label: "Account" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings", label: "Brand studio" },
  { href: "/reminders", label: "Reminders" },
];
export default function ProfileMenu({ mobile = false }: { mobile?: boolean }) {
  const workspace = useWorkspace(), { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const details = useRef<HTMLDetailsElement>(null), id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.PointerEvent) => { if (event.target instanceof Node && !details.current?.contains(event.target) && details.current) details.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && details.current) { details.current.open = false; details.current.querySelector("summary")?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  async function signOut() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error();
      // Full navigation discards private caches after signing out.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/sign-in");
    } catch { setError("Unable to sign out. Try again."); setBusy(false); }
  }
  return <details ref={details} className={`${styles.profile} ${mobile ? styles.mobileProfile : ""}`} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className={styles.profileTrigger} aria-label="Open profile and settings" aria-controls={id}>
      <span className={styles.avatar} aria-hidden="true">{workspace?.user.firstName.slice(0, 1) || "T"}</span>
      <span className={styles.profileName}><strong>{workspace?.user.name || "Your profile"}</strong><small>{workspace?.workspace.name || "InvoiceFlow"}</small></span><span className={styles.profileChevron} aria-hidden="true">⌃</span>
    </summary>
    <div id={id} className={styles.profilePanel}>
      <fieldset className={styles.themeChoices}><legend>Appearance</legend>{(["light", "dark"] as const).map(value => <label key={value}><input type="radio" name={`${id}-theme`} value={value} checked={theme === value} onChange={() => setTheme(value)} /><span aria-hidden="true">{value === "light" ? "☀" : "☾"}</span>{value === "light" ? "Light" : "Dark"}</label>)}</fieldset>
      <nav className={styles.profileLinks} aria-label="Profile settings">{profileLinks.map(link => <Link key={link.href} href={link.href} onClick={() => { if (details.current) details.current.open = false; }}>{link.label}<span aria-hidden="true">↗</span></Link>)}</nav>
      {workspace && <button type="button" className={styles.signout} disabled={busy} onClick={signOut}>{busy ? "Signing out…" : "Sign out"}</button>}
      {error && <p className={styles.profileError} role="alert">{error}</p>}
    </div>
  </details>;
}
