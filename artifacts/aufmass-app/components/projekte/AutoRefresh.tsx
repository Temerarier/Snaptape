"use client";
// Pollt die Server-Komponente, solange ein Projekt gemessen wird:
// router.refresh() lädt die Seite serverseitig neu; wechselt der Status
// auf model_ready/failed, greifen die redirects der Detailseite.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 3000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
