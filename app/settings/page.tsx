"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import AppShell from "../components/app-shell";
import { useBrand, saveBrand, type BrandSettings } from "../../lib/local-data";
import { brandForeground } from "../../lib/brand-colour";
import styles from "../workspace.module.css";

const defaults: BrandSettings = { company: "The Code Squad", tagline: "IT Support Services", companyAddress: "", businessIdentifier: "", brand: "#7240c4", payment: "", logo: "" };
const palette = ["#7240c4", "#522494", "#9856e8", "#7c3aed", "#b05bea", "#382054"];

export default function SettingsPage() {
  const saved = useBrand();
  const [edits, setEdits] = useState<BrandSettings | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = edits ?? saved ?? defaults;
  const change = (key: keyof BrandSettings, value: string) => { setEdits({ ...current, [key]: value }); setMessage(""); };
  const readLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(false); setMessage("");
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) { setError(true); setMessage("Choose a PNG or JPG logo no larger than 2 MB."); return; }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      if (!(file.type === "image/png" ? png : jpeg)) throw new Error("This file does not contain a valid PNG or JPG image.");
      const logo = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The logo could not be read.")); reader.onerror = () => reject(new Error("The logo could not be read.")); reader.readAsDataURL(file); });
      await new Promise<void>((resolve, reject) => { const image = new window.Image(); image.onload = () => image.naturalWidth * image.naturalHeight <= 20000000 ? resolve() : reject(new Error("Choose a logo under 20 megapixels.")); image.onerror = () => reject(new Error("The logo image could not be opened.")); image.src = logo; });
      setEdits(previous => ({ ...(previous ?? saved ?? defaults), logo }));
      setMessage("Logo ready. Save your brand to use it in the creator.");
    } catch (error) { setError(true); setMessage(error instanceof Error ? error.message : "The logo could not be loaded."); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current.company.trim()) { setError(true); setMessage("Enter your company name before saving."); return; }
    if (!/^#[0-9a-f]{6}$/i.test(current.brand)) { setError(true); setMessage("Use a six-digit colour such as #7240c4."); return; }
    try { await saveBrand({ ...current, company: current.company.trim(), brand: current.brand.toLowerCase() }); setError(false); setMessage("Your brand is saved to your private workspace. In the creator, choose Apply saved branding to use it."); setEdits(null); }
    catch (error) { setError(true); setMessage(error instanceof Error ? error.message : "Your brand could not be saved."); }
  };
  return <AppShell title="A brand that's unmistakably you." subtitle="Your company identity, translated into every invoice. Personalise the details and preview the result.">
    <div className={styles.notice}><span aria-hidden="true">✦</span><span>InvoiceFlow is a TCS platform. Your own company branding is applied to your invoices. Settings are saved to your private workspace.</span></div>
    <form onSubmit={submit}>
      <div className={styles.formGrid}>
        <section className={styles.panel} data-glow="true" aria-labelledby="business-heading"><div className={styles.panelHeading}><h2 className={styles.panelTitle} id="business-heading">Company identity</h2><span className={styles.eyebrow}>01 / DETAILS</span></div><div className={styles.fields}>
          <label className={styles.field}>Company name<input className={styles.input} value={current.company} onChange={event => change("company", event.target.value)} required maxLength={300} autoComplete="organization" placeholder="Your company name" /></label>
          <label className={styles.field}>Tagline / business description<input className={styles.input} value={current.tagline} onChange={event => change("tagline", event.target.value)} maxLength={300} placeholder="What you do, in a few words" /></label>
          <label className={styles.field}>Company address<textarea className={styles.textarea} value={current.companyAddress} onChange={event => change("companyAddress", event.target.value)} maxLength={2000} autoComplete="street-address" placeholder="Street address, city and postcode" /></label>
          <label className={styles.field}>ABN / business identifier<input className={styles.input} value={current.businessIdentifier} onChange={event => change("businessIdentifier", event.target.value)} maxLength={100} placeholder="Your confirmed business identifier" /><small>Use the business identifier appropriate for your company and country.</small></label>
          <label className={styles.field}>Payment details<textarea className={styles.textarea} value={current.payment} onChange={event => change("payment", event.target.value)} maxLength={2000} placeholder={"Account name\nBSB / routing number\nAccount number\nPayment reference instructions"} /><small>These details will appear on invoices where you apply this brand.</small></label>
        </div></section>
        <section className={styles.panel} data-glow="true" aria-labelledby="visual-heading"><div className={styles.panelHeading}><h2 className={styles.panelTitle} id="visual-heading">The visual signature</h2><span className={styles.eyebrow}>02 / BRAND</span></div>
          <div className={styles.logoUpload}>{current.logo ? <Image unoptimized src={current.logo} alt={`${current.company || "Company"} logo preview`} width={110} height={75} className={styles.logoPreview} /> : <span className={styles.emptyGlyph} aria-hidden="true" style={{ marginBottom: 0 }}>✦</span>}<label className={styles.field} style={{ textAlign: "center" }}><span>{busy ? "Reading your logo…" : "Company logo"}</span><input type="file" accept="image/png,image/jpeg" className={styles.logoInput} onChange={readLogo} disabled={busy} /></label><p>PNG or JPG · Up to 2 MB<br />Your logo keeps its original proportions.</p>{current.logo && <button className={styles.remove} type="button" disabled={busy} onClick={() => change("logo", "")}>Remove logo</button>}</div>
          <div className={styles.fields}><div className={styles.field}><span>Invoice accent colour</span><div className={styles.swatches}>{palette.map(colour => <button key={colour} type="button" className={`${styles.swatch} ${current.brand.toLowerCase() === colour ? styles.swatchSelected : ""}`} style={{ background: colour }} aria-label={`Use invoice accent ${colour}`} aria-pressed={current.brand.toLowerCase() === colour} onClick={() => change("brand", colour)} />)}<label><span className={styles.screenreader}>Choose any invoice accent colour</span><input className={styles.colorInput} type="color" value={current.brand} onChange={event => change("brand", event.target.value)} /></label></div></div></div>
          <div className={styles.brandPreview} data-glow="true" aria-label="Live brand preview"><div className={styles.brandPreviewHeader} style={{ background: current.brand, color: brandForeground(current.brand) }}>{current.logo ? <Image unoptimized src={current.logo} width={80} height={37} alt="" className={styles.brandPreviewLogo} /> : <span aria-hidden="true">{"</>"}</span>}<small>INVOICE / 001</small></div><div className={styles.brandPreviewBody}><h3>{current.company || "Your company"}</h3><p>{current.tagline || "Your business description"}</p><div className={styles.brandPreviewDivider} /><div className={styles.brandPreviewTable}><strong>SERVICES</strong><span>AMOUNT</span></div><div className={styles.previewBar} /><div className={styles.previewBar} /><div className={styles.brandPreviewTotal} style={{ background: current.brand, color: brandForeground(current.brand) }}><strong>YOUR BRAND</strong><span>YOUR NEXT INVOICE</span></div></div></div><p className={styles.storageNote}>A visual preview of your branding. Amounts and customer details are configured in the invoice creator.</p>
        </section>
      </div>
      <div className={styles.saveRow}><button type="submit" className={styles.primary} disabled={busy}>{busy ? "Reading logo…" : "Save your brand"}<span aria-hidden="true">↗</span></button><Link href="/create" className={styles.secondary}>Open invoice creator</Link><button className={styles.remove} type="button" disabled={busy} onClick={() => { setEdits(null); setMessage("Unsaved changes discarded."); setError(false); }}>Discard unsaved changes</button></div>
      {message && <p className={`${styles.message} ${error ? styles.error : ""}`} role="status">{message}</p>}
    </form>
  </AppShell>;
}
