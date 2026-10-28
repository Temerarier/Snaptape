import { AutoRefresh } from "./AutoRefresh";

export function Model3dProgress({ status, pendingText, unavailableText }: {
  status: "pending" | "ready" | "unavailable" | null;
  pendingText: string; unavailableText: string;
}) {
  if (status !== "pending" && status !== "unavailable") return null;
  return (
    <div role="status" data-model3d-status={status} className="border-b border-linie bg-flaeche px-6 py-3 text-sm text-schrift-sekundaer">
      {status === "pending" ? pendingText : unavailableText}
      {status === "pending" ? <AutoRefresh /> : null}
    </div>
  );
}
