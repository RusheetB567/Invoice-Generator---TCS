"use client";
import { useEffect, useState, type FormEvent } from "react";
import AppShell from "./app-shell";
import type { Contact } from "../../lib/domain/contact";
import styles from "../vault.module.css";
import formStyles from "../auth.module.css";
export default function Directory({ kind }: { kind: "Client" | "Supplier" }) {
  const [contacts, setContacts] = useState<Contact[]>([]),
    [query, setQuery] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [editing, setEditing] = useState<Contact | null>(null),
    [adding, setAdding] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/contacts", { signal: abort.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        setContacts(body.contacts);
        setLoading(false);
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => abort.abort();
  }, []);
  async function post(body: unknown) {
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error);
    setContacts(value.contacts);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      await post({
        ...Object.fromEntries(data),
        kind,
        ...(editing ? { id: editing.id } : {}),
      });
      setAdding(false);
      setEditing(null);
      setMessage(`${kind} saved to your business workspace.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  async function archive(contact: Contact) {
    setBusy(true);
    try {
      await post({ id: contact.id, archive: !contact.archived });
      setMessage(
        contact.archived
          ? "Contact restored."
          : "Contact archived. Existing invoice details remain unchanged.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to archive.");
    } finally {
      setBusy(false);
    }
  }
  const visible = contacts.filter(
    (contact) =>
      contact.kind === kind &&
      contact.archived === showArchived &&
      `${contact.name} ${contact.email} ${contact.businessNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <AppShell
      title={
        kind === "Client" ? "People you work for." : "People you work with."
      }
      subtitle={`Your ${kind.toLowerCase()} directory, saved privately to this business.`}
    >
      <div className={styles.titleRow}>
        <label className={formStyles.field}>
          Search {kind.toLowerCase()}s
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Name, email or business number"
          />
        </label>
        <label className={formStyles.check}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
        <button
          className={styles.primary}
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          + Add {kind.toLowerCase()}
        </button>
      </div>
      {message && (
        <p role="status" className={styles.footnote}>
          {message}
        </p>
      )}
      {(adding || editing) && (
        <section className={styles.panel} data-glow="true">
          <h2>
            {editing ? "Edit" : "New"} {kind.toLowerCase()}
          </h2>
          <form
            key={editing?.id || "new"}
            className={formStyles.form}
            onSubmit={save}
          >
            <div className={formStyles.pair}>
              <label className={formStyles.field}>
                Name
                <input
                  name="name"
                  defaultValue={editing?.name || ""}
                  required
                  maxLength={200}
                />
              </label>
              <label className={formStyles.field}>
                Email
                <input
                  type="email"
                  name="email"
                  defaultValue={editing?.email || ""}
                  maxLength={254}
                />
              </label>
            </div>
            <label className={formStyles.field}>
              ABN / business number
              <input
                name="businessNumber"
                defaultValue={editing?.businessNumber || ""}
                maxLength={80}
              />
            </label>
            <label className={formStyles.field}>
              Address
              <textarea
                name="address"
                defaultValue={editing?.address || ""}
                maxLength={1000}
              />
            </label>
            <label className={formStyles.field}>
              Notes
              <textarea
                name="notes"
                defaultValue={editing?.notes || ""}
                maxLength={3000}
              />
            </label>
            <div className={styles.titleRow}>
              <button className={styles.primary} disabled={busy}>
                {busy ? "Saving…" : "Save contact"}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setAdding(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
      {loading ? (
        <p role="status">Loading your directory…</p>
      ) : visible.length ? (
        <div className={styles.recordGrid}>
          {visible.map((contact) => (
            <article
              key={contact.id}
              className={styles.record}
              data-glow="true"
            >
              <span className={styles.eyebrow}>{kind}</span>
              <h2>{contact.name}</h2>
              <p>{contact.email || "No email added"}</p>
              <p>{contact.address}</p>
              <p>{contact.businessNumber}</p>
              <p>{contact.notes}</p>
              <div className={styles.titleRow}>
                <button
                  className={styles.secondary}
                  onClick={() => {
                    setEditing(contact);
                    setAdding(false);
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.secondary}
                  disabled={busy}
                  onClick={() => archive(contact)}
                >
                  {contact.archived ? "Restore" : "Archive"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.panel}>
          <h2>
            {query
              ? "No matching contacts."
              : `Your first ${kind.toLowerCase()} belongs here.`}
          </h2>
          <p>
            Add contact details to keep them organised. Invoice party snapshots
            remain independent of future directory changes.
          </p>
        </section>
      )}
    </AppShell>
  );
}
