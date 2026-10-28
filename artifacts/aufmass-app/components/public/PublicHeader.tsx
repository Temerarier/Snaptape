import { enUS } from "@/i18n/en-US";

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-schrift">
      <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-akzent">
        <rect x="2.5" y="7" width="19" height="10" rx="2" />
        <path d="M6 7v4M10 7v3M14 7v4M18 7v3" />
      </svg>
      SnapTape
    </span>
  );
}

const btn = "inline-flex items-center justify-center rounded-eingabe px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-akzent/50 focus-visible:ring-offset-2";
export const btnPrimary = `${btn} bg-akzent text-white shadow-akzent hover:bg-akzent/90`;
export const btnSecondary = `${btn} border border-linie bg-flaeche text-schrift hover:bg-hintergrund`;

export function PublicHeader({ withSections = true }: { withSections?: boolean }) {
  const t = enUS.publicPages.nav;
  return (
    <header className="border-b border-linie bg-flaeche/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
        <a href="/" aria-label={t.home} className="rounded-eingabe py-1"><Wordmark /></a>
        {withSections && (
          <nav aria-label={t.primary} className="order-3 w-full md:order-none md:w-auto">
            <ul className="flex gap-5 text-sm text-schrift-sekundaer">
              <li><a className="hover:text-akzent" href="#how-it-works">{t.howItWorks}</a></li>
              <li><a className="hover:text-akzent" href="#pricing">{t.pricing}</a></li>
              <li><a className="hover:text-akzent" href="#faq">{t.faq}</a></li>
            </ul>
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <a href="/login" className={btnSecondary}>{t.signIn}</a>
          <a href="/login" className={btnPrimary}>{t.requestTrial}</a>
        </div>
      </div>
    </header>
  );
}
