"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AutoRefresh } from "./AutoRefresh";

// Only a page that actually observed processing follows the completed result.
// A deliberate "Add photo" visit to a ready project's upload page stays here.
export function UploadMeasurementProgress({
  status, viewerHref, message,
}: {
  status: string;
  viewerHref: string;
  message: string;
}) {
  const router = useRouter();
  const wasProcessing = useRef(status === "processing");
  useEffect(() => {
    if (status === "model_ready" && wasProcessing.current) router.replace(viewerHref);
    if (status === "processing") wasProcessing.current = true;
  }, [status, viewerHref, router]);
  if (status !== "processing") return null;
  return (
    <section className="mt-7 rounded-karte border border-linie bg-flaeche p-8 text-center" role="status" aria-busy="true">
      <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-linie border-t-akzent motion-reduce:animate-none" aria-hidden="true" />
      <p className="mt-4 text-sm text-schrift-sekundaer">{message}</p>
      <AutoRefresh />
    </section>
  );
}
