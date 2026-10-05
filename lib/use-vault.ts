"use client";
import { useEffect, useState } from "react";
import type { VaultDocument } from "./domain/tax-record";
export function useVault() {
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vault", { cache: "no-store", signal: controller.signal })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result.documents as VaultDocument[]; })
      .then(value => { if (!controller.signal.aborted) { setDocuments(value); setError(""); } })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load records."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return { documents, loading, error };
}
