import type { Dictionary } from "@/i18n";

export function KeineCreditsHinweis({
  t,
  supportEmail,
}: {
  t: Dictionary["upload"]["credits"];
  supportEmail?: string | null;
}) {
  return (
    <div role="status" className="rounded-eingabe bg-warnung-flaeche px-4 py-3">
      <p className="text-sm font-semibold text-warnung">{t.keineTitel}</p>
      <p className="mt-1 text-sm text-schrift-sekundaer">{t.keineText}</p>
      {supportEmail ? (
        <a
          href={`mailto:${supportEmail}`}
          className="mt-1.5 inline-block text-sm font-medium text-akzent underline-offset-4 hover:underline"
        >
          {t.supportLink} {supportEmail}.
        </a>
      ) : null}
    </div>
  );
}
