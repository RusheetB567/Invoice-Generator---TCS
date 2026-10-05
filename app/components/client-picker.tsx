"use client";
import { useState } from "react";
import type { Contact } from "../../lib/domain/contact";
import styles from "../create/creator.module.css";
export default function ClientPicker({
  onChoose,
}: {
  onChoose: (contact: Contact) => void;
}) {
  const [contacts, setContacts] = useState<Contact[] | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/contacts", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setContacts(
        body.contacts.filter(
          (contact: Contact) => contact.kind === "Client" && !contact.archived,
        ),
      );
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : "Unable to load clients.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      {contacts === null ? (
        <button
          className={styles.textButton}
          type="button"
          disabled={loading}
          onClick={load}
        >
          {loading ? "Loading clients…" : "Choose from client directory"}
        </button>
      ) : contacts.length ? (
        <label className={styles.field}>
          <span>Saved client</span>
          <select
            defaultValue=""
            onChange={(event) => {
              const contact = contacts.find(
                (value) => value.id === event.target.value,
              );
              if (contact) onChoose(contact);
            }}
          >
            <option value="">Choose a client</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p>
          No saved clients yet. Add one in Clients, or enter invoice details
          below.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
