"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import AppShell from "../components/app-shell";
import { useWorkspace } from "../components/workspace-provider";
import ClientPicker from "../components/client-picker";
import { readBrand, saveDraft, useBrand, useDrafts, type BrandSettings, type Draft } from "../../lib/local-data";
import { brandForeground } from "../../lib/brand-colour";
import { hundredths, lineTotal, taxTotal } from "../../lib/domain/invoice-math";
import styles from "./creator.module.css";

type Item = { id: number; description: string; details: string; quantity: string; rate: string };
type BillingSection = { id: number; heading: string; details: string; amount: string };
type Currency = "AUD" | "USD" | "GBP" | "EUR";
const currencies: Record<Currency, string> = { AUD: "A$", USD: "US$", GBP: "£", EUR: "€" };
const initial = {
  company: "THE CODE SQUAD", tagline: "IT Support Services", companyAddress: "",
  customer: "Education Embassy", customerAddress: "", location: "2/250 Orange Grove Rd, Salisbury",
  number: "005", issued: "2026-06-03", due: "2026-06-10", brand: "#7240c4", lineLabel: "Hours",
  taxLabel: "Tax", tax: "0", notes: "Thank you for your business. Please make payment by the due date.",
  payment: "", businessIdentifier: "",
};
const blank = { ...initial, company: "", tagline: "", customer: "", location: "", number: "", issued: "", due: "", notes: "" };
const emptySection: BillingSection = { id: 1, heading: "", details: "", amount: "0" };
const subscribeReadiness = () => () => undefined;
const clientReady = () => true;
const serverReady = () => false;
const seedItems: Item[] = [
  { id: 1, description: "Week: 20 Apr – 24 Apr", details: "IT Support & User Assistance\nMicrosoft 365 Administration Support\nTechnical Troubleshooting & Remote Technical Assistance", quantity: "7.5", rate: "27" },
  { id: 2, description: "Week: 27 Apr – 1 May", details: "No IT Related Issues Reported", quantity: "0", rate: "27" },
  { id: 3, description: "Week: 4 May – 8 May", details: "General IT Support & Remote User Assistance", quantity: "2", rate: "27" },
  { id: 4, description: "Week: 11 May – 15 May", details: "IT Support & System Assistance", quantity: "1.5", rate: "27" },
  { id: 5, description: "Week: 18 May – 22 May", details: "User Support, Troubleshooting & Microsoft 365 Administration Support", quantity: "6", rate: "27" },
  { id: 6, description: "Week: 25 May – 29 May", details: "General IT Support & Assistance", quantity: "1", rate: "27" },
];

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function dateLabel(value: string) {
  return validDate(value) ? new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
}
function formFromDraft(draft?: Draft, sample = false, savedBrand?: BrandSettings | null) {
  const form = { ...(sample ? initial : blank) };
  if (!draft && !sample && savedBrand) {
    const { logo: ignoredLogo, ...brand } = savedBrand;
    void ignoredLogo;
    Object.assign(form, brand);
  }
  if (draft) for (const key of Object.keys(initial) as Array<keyof typeof initial>) if (typeof draft.form[key] === "string") form[key] = draft.form[key];
  if (!/^#[0-9a-f]{6}$/i.test(form.brand)) form.brand = initial.brand;
  return form;
}

function InvoiceEditor({ startingDraft, missingDraft, sample, savedBrand }: { startingDraft?: Draft; missingDraft: boolean; sample: boolean; savedBrand: BrandSettings | null }) {
  const workspace = useWorkspace();
  const [form, setForm] = useState(() => formFromDraft(startingDraft, sample, savedBrand));
  const [format, setFormat] = useState<"sections" | "table">(startingDraft ? startingDraft.format ?? "table" : sample ? "table" : "sections");
  const [items, setItems] = useState(() => (startingDraft?.items ?? (sample ? seedItems : [])).map(item => ({ ...item })));
  const [sections, setSections] = useState<BillingSection[]>(() => (startingDraft?.sections ?? [emptySection]).map(section => ({ ...section })));
  const [currency, setCurrency] = useState<Currency>((startingDraft?.currency as Currency) ?? (sample ? "AUD" : workspace?.workspace.profile.currency || "AUD"));
  const [logo, setLogo] = useState(startingDraft?.logo ?? (!sample ? savedBrand?.logo ?? "" : ""));
  const [logoError, setLogoError] = useState("");
  const [logoLoading, setLogoLoading] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [notification, setNotification] = useState(missingDraft ? "This saved invoice could not be found in this browser. A new blank invoice is open; choose an available local draft below." : startingDraft ? `Editing saved invoice ${startingDraft.number}. Save your changes when you are ready.` : "");
  const [showValidation, setShowValidation] = useState(false);
  const [openGroups, setOpenGroups] = useState(["business", "customer", "services"]);
  const [draftChoice, setDraftChoice] = useState(startingDraft?.id ?? "");
  const [activeDraft, setActiveDraft] = useState<{ id: string; status: Draft["status"] } | null>(startingDraft ? { id: startingDraft.id, status: startingDraft.status } : null);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string; size: number }>>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const drafts = useDrafts();
  const nextId = useRef(Math.max(1, ...(startingDraft?.items ?? seedItems).map(item => item.id), ...(startingDraft?.sections ?? [emptySection]).map(section => section.id)) + 1);
  const uploadVersion = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const change = (key: keyof typeof initial, value: string) => setForm(current => ({ ...current, [key]: value }));
  const changeItem = (id: number, key: keyof Omit<Item, "id">, value: string) => setItems(current => current.map(item => item.id === id ? { ...item, [key]: value } : item));
  const changeSection = (id: number, key: keyof Omit<BillingSection, "id">, value: string) => setSections(current => current.map(section => section.id === id ? { ...section, [key]: value } : section));
  const moveSection = (index: number, direction: -1 | 1) => setSections(current => {
    const next = [...current];
    const target = index + direction;
    if (target >= 0 && target < next.length) [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const calculated = items.map(item => {
    const quantity = hundredths(item.quantity, BigInt(99999));
    const rate = hundredths(item.rate, BigInt(9999999));
    return { ...item, quantity, rate, amount: quantity !== null && rate !== null ? lineTotal(quantity, rate) : null };
  });
  const calculatedSections = sections.map(section => ({ ...section, cents: hundredths(section.amount, BigInt(9999999)) }));
  const tax = hundredths(form.tax, BigInt(100));
  const amountsValid = tax !== null && (format === "sections" ? calculatedSections.every(section => section.cents !== null) : calculated.every(item => item.amount !== null));
  const subtotal = format === "sections" ? calculatedSections.reduce((sum, section) => sum + (section.cents ?? BigInt(0)), BigInt(0)) : calculated.reduce((sum, item) => sum + (item.amount ?? BigInt(0)), BigInt(0));
  const taxAmount = tax === null ? BigInt(0) : taxTotal(subtotal, tax);
  const money = (cents: bigint | null) => cents === null ? "—" : `${currencies[currency]}${(cents / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${(cents % BigInt(100)).toString().padStart(2, "0")}`;
  const quantityLabel = (quantity: bigint | null) => quantity === null ? "—" : `${quantity / BigInt(100)}.${(quantity % BigInt(100)).toString().padStart(2, "0")}`;
  const errors = [
    ...(!form.company.trim() ? ["Enter your company name."] : []),
    ...(!form.customer.trim() ? ["Enter a customer name."] : []),
    ...(!form.number.trim() ? ["Enter an invoice number."] : []),
    ...(format === "table" && !form.lineLabel.trim() ? ["Enter a quantity column label."] : []),
    ...(!form.taxLabel.trim() ? ["Enter a tax label."] : []),
    ...(!validDate(form.issued) || !validDate(form.due) ? ["Enter valid issue and due dates."] : form.due < form.issued ? ["The due date must be on or after the issue date."] : []),
    ...(tax === null ? ["Tax must be 0–100%, with at most two decimal places."] : []),
    ...(format === "table" ? calculated.flatMap((item, index) => [
      ...(!item.description.trim() ? [`Item ${index + 1}: enter a description.`] : []),
      ...(item.quantity === null ? [`Item ${index + 1}: quantity must be 0–99,999, with at most two decimal places.`] : []),
      ...(item.rate === null ? [`Item ${index + 1}: rate must be 0–9,999,999, with at most two decimal places.`] : []),
    ]) : calculatedSections.flatMap((section, index) => [
      ...(!section.heading.trim() ? [`Section ${index + 1}: enter a heading.`] : []),
      ...(section.cents === null ? [`Section ${index + 1}: amount must be 0–9,999,999, with at most two decimal places.`] : []),
    ])),
    ...(logoError ? [logoError] : []),
  ];
  const canPrint = errors.length === 0 && !logoLoading;

  function saveCurrentDraft() {
    if (!canPrint) { setShowValidation(true); setOpenGroups(["business", "customer", "services", "payment"]); setNotification("Complete the required details before saving. Check the highlighted guidance below."); return; }
    const id = activeDraft?.id ?? window.crypto.randomUUID();
    try {
      saveDraft({ id, number: form.number, customer: form.customer, company: form.company, currency,
        subtotalCents: subtotal.toString(), taxCents: taxAmount.toString(), totalCents: (subtotal + taxAmount).toString(),
        issued: form.issued, due: form.due, status: activeDraft?.status ?? "Draft", updatedAt: new Date().toISOString(), form, items: format === "table" ? items : [], format, sections: format === "sections" ? sections : undefined, logo });
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
    setFormat(draft.format ?? "table"); setSections((draft.sections ?? [emptySection]).map(section => ({ ...section }))); setShowValidation(false);
    setLogo(draft.logo); setLogoError(""); setLogoLoading(false); setAttachments([]); setAttachmentError("");
    setActiveDraft({ id: draft.id, status: draft.status });
    nextId.current = Math.max(1, ...draft.items.map(item => item.id), ...(draft.sections ?? []).map(section => section.id)) + 1;
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
    const savedBrand = readBrand();
    ++uploadVersion.current;
    const today = new Date();
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + 7);
    const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    setForm({ ...formFromDraft(undefined, false, savedBrand), issued: localDate(today), due: localDate(dueDate) });
    setCurrency(workspace?.workspace.profile.currency || "AUD");
    setFormat("sections"); setItems([]); setSections([{ ...emptySection, id: nextId.current++ }]); setShowValidation(false);
    setLogo(savedBrand?.logo ?? ""); setLogoError(""); setLogoLoading(false); setZoom(100);
    setOpenGroups(["business", "customer", "services"]);
    if (fileInput.current) fileInput.current.value = "";
    setActiveDraft(null); setDraftChoice(""); setAttachments([]); setAttachmentError("");
    setNotification("New blank invoice started. Saved branding was applied if available. Enter a new number and customer before saving.");
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

  const field = (key: keyof typeof initial, label: string, type = "text") => <label className={styles.field} key={key}><span>{label}{["company", "customer", "number", "issued", "due", "taxLabel"].includes(key) && " *"}</span><input type={type} value={form[key]} onChange={event => change(key, event.target.value)} maxLength={300} required={["company", "customer", "number", "issued", "due", "lineLabel", "taxLabel"].includes(key)} /></label>;
  const longField = (key: "companyAddress" | "customerAddress" | "notes" | "payment", label: string) => <label className={styles.field}><span>{label}</span><textarea rows={3} value={form[key]} onChange={event => change(key, event.target.value)} maxLength={10000} /></label>;
  const groupHeading = (id: string, number: string, title: string, hint: string) => <summary onClick={event => { event.preventDefault(); setOpenGroups(current => current.includes(id) ? current.filter(group => group !== id) : [...current, id]); }}><span className={styles.groupNumber}>{number}</span><span><strong>{title}</strong><small>{hint}</small></span><span className={styles.groupArrow} aria-hidden="true">{openGroups.includes(id) ? "−" : "+"}</span></summary>;

  return (
    <AppShell title={activeDraft ? "Edit invoice" : format === "sections" ? "Write your invoice" : "Structured invoice"} subtitle={format === "sections" ? "Your words, your branding, clear amounts." : "The original Code Squad template, with editable service rows."}>
    <div className={styles.root}>
      <header className={styles.toolbar}>
        <p className={styles.saveInfo}>{activeDraft ? `Editing ${form.number}` : "New invoice"}<span>Drafts save to this browser. Unsaved edits clear on refresh. PDF uses your print dialog.</span></p>
        <div className={styles.actions}><button className={styles.secondary} type="button" disabled={logoLoading} onClick={saveCurrentDraft}>Save draft locally</button><button className={styles.primary} type="button" disabled={!canPrint} title={!canPrint ? "Complete required invoice details to enable printing" : undefined} onClick={() => window.print()}>Print / save as PDF</button></div>
      </header>
      <div className={styles.utilityBar}>
        <nav className={styles.steps} aria-label="Invoice editor sections">{[["business", "01 Brand"], ["customer", "02 Details"], ["services", "03 Write"], ["payment", "04 Payment"]].map(([id, label]) => <button type="button" key={id} aria-pressed={openGroups.includes(id)} onClick={() => { setOpenGroups(current => current.includes(id) ? current : [...current, id]); document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" }); }}>{label}</button>)}</nav>
        <details className={styles.loadOptions}><summary>Saved invoices / start new</summary><div className={styles.draftLoader}><label htmlFor="saved-draft">Saved invoice</label><select id="saved-draft" value={draftChoice} onChange={event => setDraftChoice(event.target.value)}><option value="">Choose a local draft</option>{drafts.map(draft => <option value={draft.id} key={draft.id}>{draft.number} · {draft.customer}</option>)}</select><button type="button" className={styles.textButton} disabled={!draftChoice} onClick={loadSelectedDraft} title="Replaces the current editor, including unsaved edits">Load saved draft</button><button type="button" className={styles.textButton} onClick={startNewInvoice} title="Clears current invoice details, including unsaved edits">Start new invoice</button></div></details>
      </div>
      {notification && <div className={styles.notification} role="status">{notification}</div>}
      <div className={styles.workspace}>
        <form className={styles.editor} data-glow="true" onSubmit={event => event.preventDefault()}>
          <p className={styles.editorIntro}>{format === "sections" ? "Add the scope, deliverables, or terms in your own words. Give each billed section a clear amount." : "This optional template uses hourly or quantity-based rows."}</p>
          <details id="business" className={styles.editGroup} open={openGroups.includes("business")}>{groupHeading("business", "01", "Your brand", form.company || "Company, logo, and colour")}<fieldset><legend className={styles.srOnly}>Your business and brand</legend>
            <div className={styles.brandActions}><button type="button" className={styles.textButton} onClick={applyBranding}>Apply saved branding</button><Link href="/settings">Branding settings ↗</Link></div>
            {field("company", "Company name")}
            <details className={styles.optionalDetails}><summary>Logo, colour, and optional company details</summary>
            {field("tagline", "Tagline or service type")}
            {longField("companyAddress", "Company address (optional)")}{field("businessIdentifier", "Business / tax identifier (optional)")}
            <div className={styles.pair}>{field("brand", "Invoice colour", "color")}<label className={styles.field}><span>Logo · PNG / JPG, up to 2 MB</span><input ref={fileInput} type="file" accept="image/png,image/jpeg" onChange={event => void uploadLogo(event.target.files?.[0])} /></label></div>
            {(logo || logoError) && <button type="button" className={styles.textButton} onClick={() => { ++uploadVersion.current; setLogo(""); setLogoError(""); setLogoLoading(false); if (fileInput.current) fileInput.current.value = ""; }}>Remove / reset logo</button>}
            {logoLoading && <p role="status">Reading logo…</p>}
            </details>
          </fieldset></details>
          <details id="customer" className={styles.editGroup} open={openGroups.includes("customer")}>{groupHeading("customer", "02", "Invoice details", form.customer || "Customer, number, dates, and currency")}<fieldset><legend className={styles.srOnly}>Customer and invoice details</legend>
            <ClientPicker onChoose={contact=>setForm(current=>({...current,customer:contact.name,customerAddress:contact.address}))} />
            {field("customer", "Bill to")}
            <div className={styles.pair}>{field("number", "Invoice number")}<label className={styles.field}><span>Currency</span><select value={currency} onChange={event => setCurrency(event.target.value as Currency)}>{Object.keys(currencies).map(code => <option key={code} value={code}>{code}</option>)}</select></label></div>
            <p className={styles.hint}>Changing currency relabels your prices; it does not convert them.</p>
            <div className={styles.pair}>{field("issued", "Issue date", "date")}{field("due", "Due date", "date")}</div>
            <details className={styles.optionalDetails}><summary>Optional customer address and service location</summary>{longField("customerAddress", "Customer address (optional)")}{field("location", "Service location (optional)")}</details>
          </fieldset></details>
          <details id="services" className={styles.editGroup} open={openGroups.includes("services")}>{groupHeading("services", "03", format === "sections" ? "Write your invoice" : "Services and prices", format === "sections" ? `${sections.length} billing section${sections.length === 1 ? "" : "s"} · ${money(amountsValid ? subtotal : null)}` : `${items.length} line items`)}<fieldset><legend className={styles.srOnly}>Invoice billing content</legend>
            {format === "sections" ? <>
              {sections.map((section, index) => <div className={styles.sectionEditor} key={section.id}>
                <div className={styles.itemHeading}><strong>Section {index + 1}</strong><div className={styles.sectionActions}><button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label={`Move section ${index + 1} up`}>↑</button><button type="button" disabled={index === sections.length - 1} onClick={() => moveSection(index, 1)} aria-label={`Move section ${index + 1} down`}>↓</button><button className={styles.textButton} type="button" disabled={sections.length === 1} onClick={() => setSections(current => current.filter(row => row.id !== section.id))}>Remove</button></div></div>
                <label className={styles.field}><span>Section heading *</span><input value={section.heading} placeholder="What are you billing for?" required maxLength={300} onChange={event => changeSection(section.id, "heading", event.target.value)} /></label>
                <label className={styles.field}><span>Scope, details, or deliverables</span><textarea rows={6} value={section.details} placeholder="Describe the work, milestone, products, or agreement in your own words." maxLength={10000} onChange={event => changeSection(section.id, "details", event.target.value)} /></label>
                <label className={styles.field}><span>Section amount ({currency}) *</span><input inputMode="decimal" value={section.amount} maxLength={12} aria-invalid={calculatedSections[index].cents === null} onChange={event => changeSection(section.id, "amount", event.target.value)} /></label>
              </div>)}
              <button className={styles.secondary} type="button" disabled={sections.length >= 50} onClick={() => setSections(current => [...current, { ...emptySection, id: nextId.current++ }])}>+ Add billing section</button>
              <p className={styles.hint}>A single section works for a fixed fee. Add more sections for milestones or separate charges, and reorder them to suit your document. Amounts are entered explicitly; descriptions do not change the maths.</p>
            </> : <>
            {field("lineLabel", "Quantity column label, e.g. Hours or Quantity")}
            {items.map((item, index) => <div className={styles.itemEditor} key={item.id}>
              <div className={styles.itemHeading}><strong>Item {index + 1}</strong><button type="button" className={styles.textButton} disabled={items.length === 1} onClick={() => setItems(current => current.filter(row => row.id !== item.id))} aria-label={`Remove item ${index + 1}`}>Remove</button></div>
              <label className={styles.field}><span>Description</span><input required value={item.description} maxLength={300} onChange={event => changeItem(item.id, "description", event.target.value)} /></label>
              <label className={styles.field}><span>Details / non-billable notes (optional)</span><textarea rows={3} value={item.details} maxLength={10000} onChange={event => changeItem(item.id, "details", event.target.value)} /></label>
              <div className={styles.pair}><label className={styles.field}><span>{form.lineLabel || "Quantity"}</span><input inputMode="decimal" value={item.quantity} maxLength={12} aria-invalid={calculated[index].quantity === null} onChange={event => changeItem(item.id, "quantity", event.target.value)} /></label><label className={styles.field}><span>Rate ({currency})</span><input inputMode="decimal" value={item.rate} maxLength={12} aria-invalid={calculated[index].rate === null} onChange={event => changeItem(item.id, "rate", event.target.value)} /></label></div>
            </div>)}
            <button className={styles.secondary} type="button" disabled={items.length >= 50} onClick={() => setItems(current => [...current, { id: nextId.current++, description: "", details: "", quantity: "1", rate: "0" }])}>+ Add line item</button>
            <p className={styles.hint}>Zero quantities are allowed. Notes do not add to billed hours. Up to 50 items.</p>
            </>}
          </fieldset></details>
          <details id="payment" className={styles.editGroup} open={openGroups.includes("payment")}>{groupHeading("payment", "04", "Tax and payment", "Tax percentage, notes, and optional bank details")}<fieldset><legend className={styles.srOnly}>Tax and payment details</legend>
            <div className={styles.pair}>{field("taxLabel", "Tax label, e.g. GST")}<label className={styles.field}><span>Tax percentage · 0–100%</span><input inputMode="decimal" value={form.tax} maxLength={6} aria-invalid={tax === null} onChange={event => change("tax", event.target.value)} /></label></div>
            {longField("notes", "Invoice notes (optional)")}{longField("payment", "Payment instructions / bank details (optional)")}
            <p className={styles.hint}>{format === "sections" ? "Section amounts exclude tax. Tax is calculated on the subtotal and rounded to the nearest cent." : "Rates exclude tax. Each line is rounded to the nearest cent before the subtotal; tax is calculated on that subtotal."}</p>
          </fieldset></details>
          <details className={styles.editGroup} open={openGroups.includes("attachments")}>{groupHeading("attachments", "+", "Reference files", "Optional · file names only in this preview")}<fieldset><legend className={styles.srOnly}>Attachments</legend>
            <label className={styles.attachmentPicker}><strong>+ Choose reference files</strong><span>PDF, PNG, JPG · up to 10 MB each</span><input type="file" multiple accept="application/pdf,image/png,image/jpeg" onChange={event => { chooseAttachments(event.target.files); event.target.value = ""; }} /></label>
            <p className={styles.hint}>Names only for this preview. File contents are not read, saved, printed, or sent.</p>
            {attachmentError && <p className={styles.attachmentError} role="status">{attachmentError}</p>}
            <ul className={styles.attachmentList}>{attachments.map(file => <li key={file.id}><span>{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span><button className={styles.textButton} type="button" aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== file.id))}>Remove</button></li>)}</ul>
          </fieldset></details>
          {showValidation && errors.length > 0 && <div className={styles.errors} role="status"><strong>Complete these details</strong><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
          <p className={styles.hint}>* Required before saving or printing.</p>
          <p className={styles.hint}>Choose “Save as PDF” in the print dialog. Use A4 or Letter and turn off browser headers and footers.</p>
        </form>
        <section className={styles.previewArea} aria-label="Live invoice preview">
          <div className={styles.previewLabel}><span><i />Live preview</span><span>{currency} · {format === "sections" ? "Flexible document" : "Structured template"}</span></div>
          <div className={styles.zoomControls}><label htmlFor="preview-zoom">Preview zoom</label><input id="preview-zoom" type="range" min="80" max="120" step="5" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><output htmlFor="preview-zoom">{zoom}%</output><button className={styles.textButton} type="button" onClick={() => setZoom(100)}>Reset</button></div>
          <div className={styles.previewViewport} data-glow="true">
          <article className={styles.invoice} style={{ "--invoice-brand": form.brand, "--invoice-foreground": brandForeground(form.brand), "--preview-zoom": zoom / 100 } as CSSProperties}>
            <div className={styles.banner}>{logo ? <Image className={styles.logo} src={logo} alt={`${form.company || "Company"} logo`} width={120} height={72} unoptimized /> : <span className={styles.logoPlaceholder} aria-hidden="true">{form.company.trim().toUpperCase() === "THE CODE SQUAD" ? "</>" : form.company.trim().split(/\s+/).slice(0, 2).map(word => word[0] || "").join("").toUpperCase() || "IF"}</span>}<span>INVOICE</span></div>
            <div className={styles.invoiceBody}>
              <header className={styles.invoiceHeading}><div><h2>{form.company || "Your company"}</h2>{form.tagline && <p className={styles.tagline}>{form.tagline}</p>}{form.companyAddress && <p className={styles.multiline}>{form.companyAddress}</p>}{form.businessIdentifier && <p className={styles.identifier}>Business / tax ID: {form.businessIdentifier}</p>}</div><dl className={styles.meta}><div><dt>Invoice #</dt><dd>{form.number || "—"}</dd></div><div><dt>Issued</dt><dd>{dateLabel(form.issued)}</dd></div><div><dt>Due</dt><dd>{dateLabel(form.due)}</dd></div></dl></header>
              <div className={styles.customerGrid}><section><h3>BILL TO</h3><p>{form.customer || "Your customer"}</p>{form.customerAddress && <p className={styles.multiline}>{form.customerAddress}</p>}</section>{form.location && <section><h3>SERVICE LOCATION</h3><p>{form.location}</p></section>}</div>
              {format === "sections" ? <div className={styles.billingBody}>{calculatedSections.map(section => <section className={styles.billingSection} key={section.id}><header><h3>{section.heading || "Your section heading"}</h3><span>{money(section.cents)}</span></header>{section.details ? <p className={styles.multiline}>{section.details}</p> : !section.heading.trim() ? <p className={styles.emptyNarrative}>Add the description and details you want your customer to see.</p> : null}</section>)}</div> : <>
              <h3 className={styles.servicesTitle}>Services provided</h3>
              <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Invoice line items and prices in {currency}</caption><thead><tr><th scope="col">Description</th><th scope="col">Details</th><th scope="col" className={styles.numeric}>{form.lineLabel || "Quantity"}</th><th scope="col" className={styles.numeric}>Rate</th><th scope="col" className={styles.numeric}>Amount</th></tr></thead><tbody>{calculated.map(item => <tr key={item.id}><th scope="row">{item.description || "Untitled item"}</th><td className={styles.multiline}>{item.details}</td><td className={styles.numeric}>{quantityLabel(item.quantity)}</td><td className={styles.numeric}>{money(item.rate)}</td><td className={styles.numeric}>{money(item.amount)}</td></tr>)}</tbody></table></div>
              </>}
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
  const brand = useBrand();
  const ready = useSyncExternalStore(subscribeReadiness, clientReady, serverReady);
  const requestedId = params.get("draft");
  const draft = requestedId ? drafts.find(item => item.id === requestedId) : undefined;
  const sample = !requestedId && params.get("template") === "tcs";
  const editorKey = draft ? `draft:${draft.id}` : requestedId ? `missing:${requestedId}:${brand ? "brand" : "blank"}` : sample ? "sample:tcs" : `new:${brand ? "brand" : "blank"}`;
  if (!ready) return <AppShell title="Invoice studio"><p role="status">Opening your invoice studio…</p></AppShell>;
  return <InvoiceEditor key={editorKey} startingDraft={draft} missingDraft={Boolean(requestedId && !draft)} sample={sample} savedBrand={brand} />;
}

export default function CreateInvoice() {
  return <Suspense fallback={<AppShell title="Invoice studio"><p role="status">Opening your invoice studio…</p></AppShell>}><DraftResolver /></Suspense>;
}

