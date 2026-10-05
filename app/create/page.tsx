"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type CSSProperties } from "react";
import AppShell from "../components/app-shell";
import { readBrand, saveDraft, useDrafts, type Draft } from "../../lib/local-data";
import { brandForeground } from "../../lib/brand-colour";
import styles from "./creator.module.css";

type Item = { id: number; description: string; details: string; quantity: string; rate: string };
type Currency = "AUD" | "USD" | "GBP" | "EUR";
const currencies: Record<Currency, string> = { AUD: "A$", USD: "US$", GBP: "£", EUR: "€" };
const initial = {
  company: "THE CODE SQUAD", tagline: "IT Support Services", companyAddress: "",
  customer: "Education Embassy", customerAddress: "", location: "2/250 Orange Grove Rd, Salisbury",
  number: "005", issued: "2026-06-03", due: "2026-06-10", brand: "#7240c4", lineLabel: "Hours",
  taxLabel: "Tax", tax: "0", notes: "Thank you for your business. Please make payment by the due date.",
  payment: "", businessIdentifier: "",
};
const seedItems: Item[] = [
  { id: 1, description: "Week: 20 Apr – 24 Apr", details: "IT Support & User Assistance\nMicrosoft 365 Administration Support\nTechnical Troubleshooting & Remote Technical Assistance", quantity: "7.5", rate: "27" },
  { id: 2, description: "Week: 27 Apr – 1 May", details: "No IT Related Issues Reported", quantity: "0", rate: "27" },
  { id: 3, description: "Week: 4 May – 8 May", details: "General IT Support & Remote User Assistance", quantity: "2", rate: "27" },
  { id: 4, description: "Week: 11 May – 15 May", details: "IT Support & System Assistance", quantity: "1.5", rate: "27" },
  { id: 5, description: "Week: 18 May – 22 May", details: "User Support, Troubleshooting & Microsoft 365 Administration Support", quantity: "6", rate: "27" },
  { id: 6, description: "Week: 25 May – 29 May", details: "General IT Support & Assistance", quantity: "1", rate: "27" },
];

// Store all quantities, prices, and tax percentages as integers with two decimal places.
function hundredths(value: string, maximum: bigint): bigint | null {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const parsed = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return parsed <= maximum * BigInt(100) ? parsed : null;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function dateLabel(value: string) {
  return validDate(value) ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
}
function formFromDraft(draft?: Draft) {
  const form = { ...initial };
  if (draft) for (const key of Object.keys(initial) as Array<keyof typeof initial>) if (typeof draft.form[key] === "string") form[key] = draft.form[key];
  if (!/^#[0-9a-f]{6}$/i.test(form.brand)) form.brand = initial.brand;
  return form;
}

function InvoiceEditor({ startingDraft, missingDraft }: { startingDraft?: Draft; missingDraft: boolean }) {
  const [form, setForm] = useState(() => formFromDraft(startingDraft));
  const [items, setItems] = useState(() => (startingDraft?.items ?? seedItems).map(item => ({ ...item })));
  const [currency, setCurrency] = useState<Currency>((startingDraft?.currency as Currency) ?? "AUD");
  const [logo, setLogo] = useState(startingDraft?.logo ?? "");
  const [logoError, setLogoError] = useState("");
  const [logoLoading, setLogoLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [notification, setNotification] = useState(missingDraft ? "This saved invoice could not be found in this browser. The sample is shown instead; choose an available local draft below." : startingDraft ? `Editing saved invoice ${startingDraft.number}. Changes are saved only when you choose Save draft locally.` : "");
  const [draftChoice, setDraftChoice] = useState(startingDraft?.id ?? "");
  const [activeDraft, setActiveDraft] = useState<{ id: string; status: Draft["status"] } | null>(startingDraft ? { id: startingDraft.id, status: startingDraft.status } : null);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const drafts = useDrafts();
  const nextId = useRef(Math.max(...(startingDraft?.items ?? seedItems).map(item => item.id)) + 1);
  const uploadVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const change = (key: keyof typeof initial, value: string) => setForm(current => ({ ...current, [key]: value }));
  const changeItem = (id: number, key: keyof Omit<Item, "id">, value: string) => setItems(current => current.map(item => item.id === id ? { ...item, [key]: value } : item));
  const calculated = items.map(item => {
    const quantity = hundredths(item.quantity, BigInt(99999));
    const rate = hundredths(item.rate, BigInt(9999999));
    return { ...item, quantity, rate, amount: quantity !== null && rate !== null ? (quantity * rate + BigInt(50)) / BigInt(100) : null };
  });
  const tax = hundredths(form.tax, BigInt(100));
  const amountsValid = tax !== null && calculated.every(item => item.amount !== null);
  const subtotal = calculated.reduce((sum, item) => sum + (item.amount ?? BigInt(0)), BigInt(0));
  const taxAmount = tax === null ? BigInt(0) : (subtotal * tax + BigInt(5000)) / BigInt(10000);
  const money = (cents: bigint | null) => cents === null ? "—" : `${currencies[currency]}${(cents / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
  const quantityLabel = (quantity: bigint | null) => quantity === null ? "—" : `${quantity / BigInt(100)}.${(quantity % BigInt(100)).toString().padStart(2, "0")}`;
  const errors = [
    ...(!form.company.trim() ? ["Enter your company name."] : []),
    ...(!form.customer.trim() ? ["Enter a customer name."] : []),
    ...(!form.number.trim() ? ["Enter an invoice number."] : []),
    ...(!form.lineLabel.trim() ? ["Enter a quantity column label."] : []),
    ...(!form.taxLabel.trim() ? ["Enter a tax label."] : []),
    ...(!validDate(form.issued) || !validDate(form.due) ? ["Enter valid issue and due dates."] : form.due < form.issued ? ["The due date must be on or after the issue date."] : []),
    ...(tax === null ? ["Tax must be 0–100%, with at most two decimal places."] : []),
    ...calculated.flatMap((item, index) => [
      ...(!item.description.trim() ? [`Item ${index + 1}: enter a description.`] : []),
      ...(item.quantity === null ? [`Item ${index + 1}: quantity must be 0–99,999, with at most two decimal places.`] : []),
      ...(item.rate === null ? [`Item ${index + 1}: rate must be 0–9,999,999, with at most two decimal places.`] : []),
    ]),
    ...(logoError ? [logoError] : []),
  ];
  const canPrint = errors.length === 0 && !logoLoading;

  function saveCurrentDraft() {
    if (!canPrint) return;
    const id = activeDraft?.id ?? window.crypto.randomUUID();
    try {
      saveDraft({ id, number: form.number, customer: form.customer, company: form.company, currency,
        subtotalCents: subtotal.toString(), taxCents: taxAmount.toString(), totalCents: (subtotal + taxAmount).toString(),
        issued: form.issued, due: form.due, status: activeDraft?.status ?? "Draft", updatedAt: new Date().toISOString(), form, items, logo });
      setActiveDraft({ id, status: activeDraft?.status ?? "Draft" });
      setDraftChoice(id);
      setNotification(`Invoice ${form.number} saved in this browser. Attachment names are not saved.`);
    } catch (error) { setNotification(error instanceof Error ? error.message : "Unable to save this draft locally."); }
  }
  function loadSelectedDraft() {
    const draft = drafts.find(item => item.id === draftChoice);
    if (!draft) { setNotification("Choose a saved invoice to load."); return; }
    ++uploadVersion.current;
    setForm(formFromDraft(draft)); setItems(draft.items.map(item => ({ ...item }))); setCurrency(draft.currency as Currency);
    setLogo(draft.logo); setLogoError(""); setLogoLoading(false); setAttachments([]); setAttachmentError("");
    setActiveDraft({ id: draft.id, status: draft.status });
    nextId.current = Math.max(...draft.items.map(item => item.id)) + 1;
    setNotification(`Loaded invoice ${draft.number}. Your previous unsaved edits were replaced.`);
  }
  function applyBranding() {
    const brand = readBrand();
    if (!brand) { setNotification("No saved brand settings yet. Add them on the Branding page."); return; }
    const { logo: savedLogo, ...business } = brand;
    ++uploadVersion.current;
    setForm(current => ({ ...current, ...business })); setLogo(savedLogo); setLogoError(""); setLogoLoading(false);
    setNotification("Saved branding applied. Review your invoice before saving or printing.");
  }
  function startNewInvoice() {
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setForm(current => ({ ...current, customer: "", customerAddress: "", location: "", number: "", issued: localDate(today), due: localDate(dueDate) }));
    setItems([{ id: nextId.current++, description: "", details: "", quantity: "1", rate: "0" }]);
    setActiveDraft(null); setDraftChoice(""); setAttachments([]); setAttachmentError("");
    setNotification("New invoice started with your current branding. Enter a new number and customer before saving.");
  }
  function chooseAttachments(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    const invalid = selected.some(file => file.size > 10 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg"].includes(file.type));
    if (invalid) { setAttachmentError("Choose PDF, PNG, or JPG files no larger than 10 MB each."); return; }
    if (attachments.length + selected.length > 10) { setAttachmentError("Choose up to 10 attachments for this preview."); return; }
    setAttachmentError("");
    setAttachments(current => [...current, ...selected.map(file => ({ id: window.crypto.randomUUID(), name: file.name, size: file.size }))]);
  }

  async function uploadLogo(file?: File) {
    const version = ++uploadVersion.current;
    setLogoError("");
    setLogoLoading(false);
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setLogoError("Choose a PNG or JPG logo no larger than 2 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setLogoLoading(true);
    try {
      const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const png = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => header[index] === byte);
      const jpg = header[0] === 255 && header[1] === 216 && header[2] === 255;
      if ((file.type === "image/png" && !png) || (file.type === "image/jpeg" && !jpg)) throw new Error("image");
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read"));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      const decoded = new window.Image();
      decoded.src = data;
      await decoded.decode();
      if (version === uploadVersion.current) setLogo(data);
    } catch {
      if (version === uploadVersion.current) setLogoError("This image could not be read. Choose a valid PNG or JPG logo.");
    } finally {
      if (version === uploadVersion.current) {
        setLogoLoading(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  }

  const field = (key: keyof typeof initial, label: string, type = "text") => <label className={styles.field} key={key}><span>{label}</span><input type={type} value={form[key]} onChange={event => change(key, event.target.value)} maxLength={300} required={["company", "customer", "number", "issued", "due", "lineLabel", "taxLabel"].includes(key)} /></label>;
  const longField = (key: "companyAddress" | "customerAddress" | "notes" | "payment", label: string) => <label className={styles.field}><span>{label}</span><textarea rows={3} value={form[key]} onChange={event => change(key, event.target.value)} maxLength={10000} /></label>;

  return (
    <AppShell title="Invoice studio" subtitle="A professional invoice, built around your business.">
    <div className={styles.root}>
      <header className={styles.toolbar}>
        <div><span className={styles.eyebrow}>CREATE / PERSONALISE / PREVIEW</span><h2>Make it unmistakably yours.</h2></div>
        <div className={styles.actions}><button className={styles.secondary} type="button" disabled={!canPrint} onClick={saveCurrentDraft}>Save draft locally</button><button className={styles.primary} type="button" disabled={!canPrint} onClick={() => window.print()}>Print / save as PDF</button></div>
      </header>
      <p className={styles.notice}><span aria-hidden="true">◈</span> Browser workspace · Save drafts explicitly to keep them in this browser. Unsaved edits disappear on refresh. PDF export uses the print dialog; there is no cloud sync or email delivery.</p>
      <div className={styles.utilityBar}>
        <nav className={styles.steps} aria-label="Invoice editor sections"><a href="#business">01 Business</a><a href="#customer">02 Customer</a><a href="#services">03 Services</a><a href="#payment">04 Payment</a></nav>
        <div className={styles.draftLoader}><label htmlFor="saved-draft">Saved invoice</label><select id="saved-draft" value={draftChoice} onChange={event => setDraftChoice(event.target.value)}><option value="">Choose a local draft</option>{drafts.map(draft => <option value={draft.id} key={draft.id}>{draft.number} · {draft.customer}</option>)}</select><button type="button" className={styles.textButton} disabled={!draftChoice} onClick={loadSelectedDraft} title="Replaces the current editor, including unsaved edits">Load saved draft</button><button type="button" className={styles.textButton} onClick={startNewInvoice} title="Clears current invoice details, including unsaved edits">Start new invoice</button></div>
      </div>
      {notification && <div className={styles.notification} role="status">{notification}</div>}
      <div className={styles.workspace}>
        <form className={styles.editor} onSubmit={event => event.preventDefault()}>
          <fieldset id="business"><legend><span>01</span>Your business & brand</legend>
            <div className={styles.brandActions}><button type="button" className={styles.textButton} onClick={applyBranding}>Apply saved branding</button><Link href="/settings">Branding settings ↗</Link></div>
            {field("company", "Company name")}{field("tagline", "Tagline or service type")}
            {longField("companyAddress", "Company address (optional)")}{field("businessIdentifier", "Business / tax identifier (optional)")}
            <div className={styles.pair}>{field("brand", "Invoice colour", "color")}<label className={styles.field}><span>Logo · PNG / JPG, up to 2 MB</span><input ref={fileInput} type="file" accept="image/png,image/jpeg" onChange={event => void uploadLogo(event.target.files?.[0])} /></label></div>
            {(logo || logoError) && <button type="button" className={styles.textButton} onClick={() => { ++uploadVersion.current; setLogo(""); setLogoError(""); setLogoLoading(false); if (fileInput.current) fileInput.current.value = ""; }}>Remove / reset logo</button>}
            {logoLoading && <p role="status">Reading logo…</p>}
          </fieldset>
          <fieldset id="customer"><legend><span>02</span>Customer & invoice</legend>
            {field("customer", "Bill to")}{longField("customerAddress", "Customer address (optional)")}{field("location", "Service location (optional)")}
            <div className={styles.pair}>{field("number", "Invoice number")}<label className={styles.field}><span>Currency</span><select value={currency} onChange={event => setCurrency(event.target.value as Currency)}>{Object.keys(currencies).map(code => <option key={code} value={code}>{code}</option>)}</select></label></div>
            <p className={styles.hint}>Changing currency relabels your prices; it does not convert them.</p>
            <div className={styles.pair}>{field("issued", "Issue date", "date")}{field("due", "Due date", "date")}</div>
          </fieldset>
          <fieldset id="services"><legend><span>03</span>Services & prices</legend>
            {field("lineLabel", "Quantity column label, e.g. Hours or Quantity")}
            {items.map((item, index) => <div className={styles.itemEditor} key={item.id}>
              <div className={styles.itemHeading}><strong>Item {index + 1}</strong><button type="button" className={styles.textButton} disabled={items.length === 1} onClick={() => setItems(current => current.filter(row => row.id !== item.id))} aria-label={`Remove item ${index + 1}`}>Remove</button></div>
              <label className={styles.field}><span>Description</span><input required value={item.description} maxLength={300} onChange={event => changeItem(item.id, "description", event.target.value)} /></label>
              <label className={styles.field}><span>Details / non-billable notes (optional)</span><textarea rows={3} value={item.details} maxLength={10000} onChange={event => changeItem(item.id, "details", event.target.value)} /></label>
              <div className={styles.pair}><label className={styles.field}><span>{form.lineLabel || "Quantity"}</span><input inputMode="decimal" value={item.quantity} maxLength={12} aria-invalid={calculated[index].quantity === null} onChange={event => changeItem(item.id, "quantity", event.target.value)} /></label><label className={styles.field}><span>Rate ({currency})</span><input inputMode="decimal" value={item.rate} maxLength={12} aria-invalid={calculated[index].rate === null} onChange={event => changeItem(item.id, "rate", event.target.value)} /></label></div>
            </div>)}
            <button className={styles.secondary} type="button" disabled={items.length >= 50} onClick={() => setItems(current => [...current, { id: nextId.current++, description: "", details: "", quantity: "1", rate: "0" }])}>+ Add line item</button>
            <p className={styles.hint}>Zero quantities are allowed. Notes do not add to billed hours. Up to 50 items.</p>
          </fieldset>
          <fieldset id="payment"><legend><span>04</span>Tax & payment</legend>
            <div className={styles.pair}>{field("taxLabel", "Tax label, e.g. GST")}<label className={styles.field}><span>Tax percentage · 0–100%</span><input inputMode="decimal" value={form.tax} maxLength={6} aria-invalid={tax === null} onChange={event => change("tax", event.target.value)} /></label></div>
            {longField("notes", "Invoice notes (optional)")}{longField("payment", "Payment instructions / bank details (optional)")}
            <p className={styles.hint}>Rates exclude tax. Each line is rounded to the nearest cent before the subtotal; tax is calculated on that subtotal.</p>
          </fieldset>
          <fieldset><legend><span>+</span>Attachments</legend>
            <label className={styles.attachmentPicker}><strong>+ Choose reference files</strong><span>PDF, PNG, JPG · up to 10 MB each</span><input type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={event => { chooseAttachments(event.target.files); event.target.value = ""; }} /></label>
            <p className={styles.hint}>Names only for this preview. File contents are not read, saved, printed, or sent.</p>
            {attachmentError && <p className={styles.attachmentError} role="status">{attachmentError}</p>}
            <ul className={styles.attachmentList}>{attachments.map(file => <li key={file.id}><span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span><button className={styles.textButton} type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== file.id))}>Remove</button></li>)}</ul>
          </fieldset>
          {errors.length > 0 && <div className={styles.errors} role="status"><strong>Before printing</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
          <div className={styles.bottomActions}><button className={styles.secondary} type="button" disabled={!canPrint} onClick={saveCurrentDraft}>Save draft locally</button><button className={styles.primary} type="button" disabled={!canPrint} onClick={() => window.print()}>Print / save as PDF</button></div>
          <p className={styles.hint}>Choose “Save as PDF” in the print dialog. Use A4 or Letter and turn off browser headers and footers.</p>
        </form>
        <section className={styles.previewArea} aria-label="Live invoice preview">
          <div className={styles.previewLabel}><span><i />Live preview</span><span>{currency} · Code Squad template</span></div>
          <div className={styles.zoomControls}><label htmlFor="preview-zoom">Preview zoom</label><input id="preview-zoom" type="range" min="80" max="120" step="5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output htmlFor="preview-zoom">{zoom}%</output><button className={styles.textButton} type="button" onClick={() => setZoom(100)}>Reset</button></div>
          <div className={styles.previewViewport}>
          <article className={styles.invoice} style={{ "--invoice-brand": form.brand, "--invoice-foreground": brandForeground(form.brand), "--preview-zoom": zoom / 100 } as CSSProperties}>
            <div className={styles.banner}>{logo ? <Image className={styles.logo} src={logo} alt={`${form.company || "Company"} logo`} width={120} height={72} unoptimized /> : <span className={styles.logoPlaceholder} aria-hidden="true">{form.company.trim().toUpperCase() === "THE CODE SQUAD" ? "</>" : form.company.trim().split(/\s+/).slice(0, 2).map(word => word[0] || "").join("").toUpperCase() || "IF"}</span>}<span>INVOICE</span></div>
            <div className={styles.invoiceBody}>
              <header className={styles.invoiceHeading}><div><h2>{form.company || "Your company"}</h2>{form.tagline && <p className={styles.tagline}>{form.tagline}</p>}{form.companyAddress && <p className={styles.multiline}>{form.companyAddress}</p>}{form.businessIdentifier && <p className={styles.identifier}>Business / tax ID: {form.businessIdentifier}</p>}</div><dl className={styles.meta}><div><dt>Invoice #</dt><dd>{form.number || "—"}</dd></div><div><dt>Issued</dt><dd>{dateLabel(form.issued)}</dd></div><div><dt>Due</dt><dd>{dateLabel(form.due)}</dd></div></dl></header>
              <div className={styles.customerGrid}><section><h3>BILL TO</h3><p>{form.customer || "Your customer"}</p>{form.customerAddress && <p className={styles.multiline}>{form.customerAddress}</p>}</section>{form.location && <section><h3>SERVICE LOCATION</h3><p>{form.location}</p></section>}</div>
              <h3 className={styles.servicesTitle}>Services provided</h3>
              <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Invoice line items and prices in {currency}</caption><thead><tr><th scope="col">Description</th><th scope="col">Details</th><th scope="col" className={styles.numeric}>{form.lineLabel || "Quantity"}</th><th scope="col" className={styles.numeric}>Rate</th><th scope="col" className={styles.numeric}>Amount</th></tr></thead><tbody>{calculated.map(item => <tr key={item.id}><th scope="row">{item.description || "Untitled item"}</th><td className={styles.multiline}>{item.details}</td><td className={styles.numeric}>{quantityLabel(item.quantity)}</td><td className={styles.numeric}>{money(item.rate)}</td><td className={styles.numeric}>{money(item.amount)}</td></tr>)}</tbody></table></div>
              <div className={styles.summary}>{form.notes && <section className={styles.notes}><h3>Notes</h3><p className={styles.multiline}>{form.notes}</p></section>}<dl className={styles.totals}><div><dt>Subtotal</dt><dd>{money(amountsValid ? subtotal : null)}</dd></div><div><dt>{form.taxLabel || "Tax"} ({tax === null ? "—" : form.tax}%)</dt><dd>{money(amountsValid ? taxAmount : null)}</dd></div><div className={styles.total}><dt>Total due</dt><dd>{money(amountsValid ? subtotal + taxAmount : null)}</dd></div></dl></div>
              {form.payment && <section className={styles.payment}><h3>Payment details</h3><p className={styles.multiline}>{form.payment}</p></section>}
              <footer className={styles.invoiceFooter}>{form.company || "Your company"} · Invoice {form.number || "—"}</footer>
            </div>
          </article>
          </div>
          <p className={styles.previewHint}>Your workspace stays dark. Your invoice stays crisp, readable, and ready to print.</p>
        </section>
      </div>
    </div>
    </AppShell>
  );
}

function DraftResolver() {
  const params = useSearchParams();
  const drafts = useDrafts();
  const requestedId = params.get("draft");
  const draft = requestedId ? drafts.find(item => item.id === requestedId) : undefined;
  const editorKey = draft ? `draft:${draft.id}` : requestedId ? `missing:${requestedId}` : "new";
  return <InvoiceEditor key={editorKey} startingDraft={draft} missingDraft={Boolean(requestedId && !draft)} />;
}

export default function CreateInvoice() {
  return <Suspense fallback={<AppShell title="Invoice studio"><p role="status">Opening your invoice studio…</p></AppShell>}><DraftResolver /></Suspense>;
}
