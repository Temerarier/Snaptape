import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { enUS } from "@/i18n/en-US";
import { MEASUREMENT_DISCLAIMER } from "@/lib/config/haftung";
import { PublicHeader, btnPrimary, btnSecondary } from "@/components/public/PublicHeader";
import { MarketingVideo } from "@/components/public/MarketingVideo";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

function supportEmail(): string | null {
  const v = process.env.SUPPORT_EMAIL?.trim();
  return v && EMAIL_RE.test(v) ? v : null;
}

function Check() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-none text-akzent">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const sectionTitle = "text-2xl font-semibold tracking-tight text-schrift md:text-3xl";

export default async function RootPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");

  const t = enUS.publicPages;
  const email = supportEmail();
  const M = "/marketing/";
  const m = enUS.publicMedia;
  const features = [
    { src: "feature-01-photos-to-measurements_1793903234264.webp", w: 2400, h: 1350 },
    { src: "feature-02-plans-to-measurements_1793903234265.webp", w: 2400, h: 1350 },
    { src: "feature-03-photos-plus-plan-mobile_1793903234265.webp", w: 2400, h: 1500 },
  ];

  return (
    <>
      <PublicHeader />
      <main className="overflow-x-clip">
        {/* Hero */}
        <section className="border-b border-linie">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:items-center md:py-20">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-akzent">{t.hero.eyebrow}</p>
              <h1 className="mt-4 text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-schrift md:text-5xl">{t.hero.title}</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-schrift-sekundaer md:text-lg">{t.hero.text}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="/login" className={`${btnPrimary} px-5 py-2.5`}>{t.hero.primary}</a>
                <a href="#see-what-you-get" className={`${btnSecondary} px-5 py-2.5`}>{t.hero.secondary}</a>
              </div>
              <p className="mt-5 font-mono text-xs text-schrift-tertiaer">{t.hero.small}</p>
            </div>

            <div className="flex justify-center">
              <MarketingVideo
                className="aspect-[516/1032] max-h-[560px] w-full max-w-[280px]"
                width={516}
                height={1032}
                poster={`${M}snaptape-hero-mobile-poster_1793903234264.jpg`}
                webm={`${M}snaptape-hero-mobile_1793903234264.webm`}
                mp4={`${M}snaptape-hero-mobile_1793903214097.mp4`}
              />
            </div>
          </div>
        </section>

        {/* On any device */}
        <section className="border-b border-linie bg-flaeche">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-akzent">{m.device.eyebrow}</p>
            <h2 className={`mt-3 ${sectionTitle}`}>{m.device.title}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-schrift-sekundaer">{m.device.text}</p>
            <div className="mt-10 overflow-hidden rounded-karte-gross border border-linie bg-flaeche shadow-karte">
              <div aria-hidden="true" className="flex h-9 items-center gap-1.5 border-b border-linie bg-hintergrund px-4">
                <span className="h-2.5 w-2.5 rounded-full bg-linie" />
                <span className="h-2.5 w-2.5 rounded-full bg-linie" />
                <span className="h-2.5 w-2.5 rounded-full bg-linie" />
              </div>
              <MarketingVideo
                className="aspect-[1512/736] w-full"
                width={1512}
                height={736}
                poster={`${M}snaptape-hero-desktop-poster_1793903234264.jpg`}
                webm={`${M}snaptape-hero-desktop_1793903234264.webm`}
                mp4={`${M}snaptape-hero-desktop_1793903234264.mp4`}
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-linie">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className={sectionTitle}>{t.how.title}</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-linie">
              {t.how.steps.map((s) => (
                <li key={s.n} className="md:px-8 md:first:pl-0 md:last:pr-0">
                  <span className="font-mono text-sm text-akzent">{s.n}</span>
                  <h3 className="mt-2 text-lg font-semibold text-schrift">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-schrift-sekundaer">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Photos, plans – or both */}
        <section className="border-b border-linie bg-flaeche">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className={sectionTitle}>{m.sources.title}</h2>
            <ul className="mt-10 space-y-14 md:space-y-20">
              {m.sources.items.map((it, i) => {
                const f = features[i];
                return (
                  <li key={f.src} className={`grid gap-6 md:items-center md:gap-12 ${i % 2 === 1 ? "md:grid-cols-[2fr_3fr]" : "md:grid-cols-[3fr_2fr]"}`}>
                    <img
                      src={`${M}${f.src}`}
                      alt={it.alt}
                      width={f.w}
                      height={f.h}
                      loading="lazy"
                      decoding="async"
                      style={{ aspectRatio: `${f.w} / ${f.h}` }}
                      className={`block h-auto w-full rounded-karte-gross border border-linie ${i % 2 === 1 ? "md:order-2" : ""}`}
                    />
                    <div className={i % 2 === 1 ? "md:order-1" : ""}>
                      <span className="font-mono text-sm text-akzent">{String(i + 1).padStart(2, "0")}</span>
                      <h3 className="mt-2 text-lg font-semibold text-schrift md:text-xl">{it.title}</h3>
                      <p className="mt-3 text-[15px] leading-7 text-schrift-sekundaer">{it.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* What you get */}
        <section id="see-what-you-get" className="scroll-mt-20 border-b border-linie">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className={sectionTitle}>{t.get.title}</h2>
            <figure className="mt-10">
              <img
                src={`${M}feature-04-3d-model-or-numbers-only_1793903234265.webp`}
                alt={m.result.alt}
                width={2400}
                height={1500}
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: "2400 / 1500" }}
                className="block h-auto w-full rounded-karte-gross border border-linie"
              />
              <figcaption className="mt-3 text-sm text-schrift-sekundaer">{m.result.caption}</figcaption>
            </figure>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {t.get.items.map((it, i) => {
                const isModel = i === t.get.items.length - 1;
                return (
                  <li key={it.title} className={`rounded-karte border border-linie bg-flaeche p-5 ${isModel ? "sm:col-span-2" : ""}`}>
                    <div className="flex gap-2">
                      <Check />
                      <h3 className="font-semibold text-schrift">{it.title}</h3>
                    </div>
                    {it.text && <p className="mt-2 pl-[26px] text-sm leading-6 text-schrift-sekundaer">{it.text}</p>}
                    {isModel && <p className="mt-3 border-t border-linie pt-3 pl-[26px] text-sm leading-6 text-schrift-tertiaer">{t.get.modelNote}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Tips */}
        <section className="border-b border-linie bg-flaeche">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className={sectionTitle}>{t.tips.title}</h2>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {t.tips.items.map((it, i) => (
                <li key={it.title} className="rounded-karte border border-linie bg-hintergrund p-5">
                  <span className="font-mono text-xs text-schrift-tertiaer">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-1 font-semibold text-schrift">{it.title}</h3>
                  {it.text && <p className="mt-1 text-sm leading-6 text-schrift-sekundaer">{it.text}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Accuracy */}
        <section id="accuracy" className="scroll-mt-20 border-b border-linie">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-akzent">{t.accuracy.eyebrow}</p>
            <h2 className={`mt-3 ${sectionTitle}`}>{t.accuracy.title}</h2>
            <p className="mt-4 text-base leading-7 text-schrift-sekundaer">{t.accuracy.text}</p>
            <blockquote className="mt-8 rounded-karte border border-linie border-l-[3px] border-l-akzent bg-flaeche px-5 py-4 text-[15px] leading-7 text-schrift">
              <p>{MEASUREMENT_DISCLAIMER}</p>
            </blockquote>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-b border-linie bg-flaeche">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className={sectionTitle}>{t.pricing.title}</h2>
            <p className="mt-3 max-w-2xl text-schrift-sekundaer">{t.pricing.intro}</p>
            <ul className="mt-10 grid gap-4 md:grid-cols-3">
              {t.pricing.plans.map((p) => (
                <li key={p.name} className={`flex flex-col rounded-karte-gross border bg-flaeche p-6 ${p.badge ? "border-akzent shadow-karte" : "border-linie"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-schrift">{p.name}</h3>
                    {p.badge && <span className="rounded-full bg-akzent/10 px-2.5 py-0.5 text-xs font-medium text-akzent">{p.badge}</span>}
                  </div>
                  <p className="mt-4 font-mono text-schrift">
                    <span className="text-3xl font-semibold">{p.price}</span>
                    <span className="text-sm text-schrift-tertiaer">{t.pricing.perMonth}</span>
                  </p>
                  <p className="mt-1 font-mono text-sm text-schrift-sekundaer">{p.credits}</p>
                  <a href="/login" className={`${p.badge ? btnPrimary : btnSecondary} mt-6`}>{t.pricing.button}</a>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-schrift-sekundaer">{t.pricing.extra}</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 border-b border-linie">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <h2 className={sectionTitle}>{t.faq.title}</h2>
            <div className="mt-8 divide-y divide-linie rounded-karte border border-linie bg-flaeche">
              {t.faq.items.map((f) => (
                <details key={f.q} className="group px-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-schrift [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-schrift-tertiaer transition-transform group-open:rotate-45">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </summary>
                  <p className="pb-4 text-[15px] leading-7 text-schrift-sekundaer">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="bg-flaeche">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center">
            <h2 className={sectionTitle}>{t.closing.title}</h2>
            <a href="/login" className={`${btnPrimary} mt-7 px-5 py-2.5`}>{t.closing.button}</a>
            {email && (
              <p className="mt-5 text-sm text-schrift-sekundaer">
                {t.closing.questions}{" "}
                <a className="text-akzent underline underline-offset-2" href={`mailto:${email}`}>{email}</a>
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
