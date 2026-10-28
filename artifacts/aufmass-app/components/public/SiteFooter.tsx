import { enUS } from "@/i18n/en-US";

// Shared footer (server component), rendered by the root layout on every route.
export function SiteFooter() {
  const t = enUS.publicPages.footer;
  return (
    <footer className="shared-site-footer border-t border-linie bg-flaeche">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-schrift-sekundaer md:flex-row md:items-start md:justify-between">
        <p className="max-w-md">{t.tagline}</p>
        <div className="flex flex-col gap-3 md:items-end">
          <nav aria-label={t.legalNav}>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              <li><a className="underline-offset-4 hover:text-akzent hover:underline" href="/legal/notice">{t.notice}</a></li>
              <li><a className="underline-offset-4 hover:text-akzent hover:underline" href="/legal/privacy">{t.privacy}</a></li>
              <li><a className="underline-offset-4 hover:text-akzent hover:underline" href="/legal/terms">{t.terms}</a></li>
            </ul>
          </nav>
          <p className="text-xs text-schrift-tertiaer">{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
