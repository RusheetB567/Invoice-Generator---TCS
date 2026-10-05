"use client";

import { useState, type FormEvent } from "react";
import AppShell from "../components/app-shell";
import { useReminders, saveReminders, type ReminderSettings } from "../../lib/local-data";
import styles from "../workspace.module.css";

const defaults: ReminderSettings = { enabled: false, days: [7, 14, 21], includeSummary: true, includePdf: true, minimumAmount: "1.00" };

export default function RemindersPage() {
  const saved = useReminders();
  const [edits, setEdits] = useState<ReminderSettings | null>(null);
  const [day, setDay] = useState("28");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const current = edits ?? saved ?? defaults;
  const change = <K extends keyof ReminderSettings>(key: K, value: ReminderSettings[K]) => { setEdits({ ...current, [key]: value }); setMessage(""); };
  const addDay = () => {
    if (!/^\d{1,3}$/.test(day) || Number(day) > 365) { setError(true); setMessage("Enter a whole number from 0 to 365 days."); return; }
    if (current.days.includes(Number(day))) { setError(true); setMessage("That reminder day is already in your timeline."); return; }
    if (current.days.length >= 20) { setError(true); setMessage("You can configure up to 20 reminder days."); return; }
    change("days", [...current.days, Number(day)].sort((a, b) => a - b)); setError(false);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (current.enabled && current.days.length === 0) { setError(true); setMessage("Add at least one day to your reminder configuration."); return; }
    if (!/^\d{1,9}(\.\d{1,2})?$/.test(current.minimumAmount)) { setError(true); setMessage("Enter a non-negative minimum amount with up to two decimal places."); return; }
    try { saveReminders(current); setEdits(null); setError(false); setMessage("Reminder settings saved locally. Emails are not scheduled or sent."); } catch (error) { setError(true); setMessage(error instanceof Error ? error.message : "Reminder settings could not be saved."); }
  };
  return <AppShell title="A gentler nudge. On your terms." subtitle="Design a reminder timeline that suits your business. Set the days, choose what to include, and save the configuration.">
    <div className={styles.notice}><span aria-hidden="true">◷</span><span><strong>Configuration preview only.</strong> Emails are not scheduled or sent. These settings prepare a future reminder workflow.</span></div>
    <form onSubmit={submit}>
      <section className={styles.panel} data-glow="true" aria-labelledby="timeline-heading"><div className={styles.panelHeading}><div><span className={styles.eyebrow}>01 / YOUR TIMELINE</span><h2 className={styles.panelTitle} id="timeline-heading" style={{ marginTop: "10px" }}>Stay on the same page.</h2></div><span className={styles.calendarGlyph} aria-hidden="true">◷</span></div><div className={styles.toggleRow}><label><input type="checkbox" checked={current.enabled} onChange={event => change("enabled", event.target.checked)} /><span><strong>Include this reminder configuration</strong><small>Your preference is saved for a future email service. It does not activate automatic emails.</small></span></label></div>
        <div className={styles.reminderGrid}>{[...current.days].sort((a, b) => a - b).map(value => <div key={value} className={styles.reminderCard} data-glow="true"><span aria-hidden="true">✉</span><strong>{value} <span style={{ fontSize: "12px", letterSpacing: "0" }}>days</span></strong><p>{value === 0 ? "On the invoice due date" : "After the invoice due date"}</p><button type="button" className={styles.remove} onClick={() => change("days", current.days.filter(item => item !== value))} aria-label={`Remove ${value}-day reminder`}>Remove from timeline</button></div>)}</div>
        {current.days.length === 0 && <p className={styles.muted}>Your timeline is empty. Add a day below to create the first reminder.</p>}
        <div className={styles.addReminder}><label className={styles.field}>Days after due date<input className={styles.input} value={day} onChange={event => setDay(event.target.value)} inputMode="numeric" placeholder="28" maxLength={3} /></label><button type="button" className={styles.secondary} onClick={addDay}>+ Add reminder day</button></div><p className={styles.storageNote}>0 means the due date. Days must be unique whole numbers, from 0 to 365.</p>
      </section>
      <section className={styles.panel} data-glow="true" aria-labelledby="message-heading" style={{ marginTop: "21px" }}><div className={styles.panelHeading}><h2 className={styles.panelTitle} id="message-heading">The useful details</h2><span className={styles.eyebrow}>02 / PREFERENCES</span></div><div className={styles.toggleRow}><label><input type="checkbox" checked={current.includeSummary} onChange={event => change("includeSummary", event.target.checked)} /><span><strong>Include an invoice summary</strong><small>Plan to include the invoice number, outstanding amount, and due date.</small></span></label></div><div className={styles.toggleRow}><label><input type="checkbox" checked={current.includePdf} onChange={event => change("includePdf", event.target.checked)} /><span><strong>Include a link to the invoice PDF</strong><small>Prepared for when online invoice storage and emailing are connected.</small></span></label></div><div className={styles.fields}><label className={styles.field} style={{ maxWidth: "330px" }}>Minimum outstanding amount<input className={styles.input} value={current.minimumAmount} onChange={event => change("minimumAmount", event.target.value)} inputMode="decimal" placeholder="1.00" maxLength={12} /><small>In each invoice’s own currency. Amounts below this threshold would be excluded.</small></label></div></section>
      <div className={styles.saveRow}><button type="submit" className={styles.primary}>Save reminder settings <span aria-hidden="true">↗</span></button><button type="button" className={styles.secondary} onClick={() => { setEdits(null); setMessage("Unsaved changes discarded."); setError(false); }}>Discard changes</button></div>{message && <p className={`${styles.message} ${error ? styles.error : ""}`} role="status">{message}</p>}
    </form>
  </AppShell>;
}
