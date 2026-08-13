'use client'

import Link from "next/link";

import { useI18n } from "@/lib/i18n";

const DEMO_ICONS: Record<string, string> = {
  demoItem1Name: "🍅",
  demoItem2Name: "🥚",
  demoItem3Name: "🍗",
  demoItem4Name: "🧀",
  demoItem5Name: "🥒",
  demoItem6Name: "🧅",
};

export default function Home() {
  const { t, dir } = useI18n();

  const demoItems = [
    t("demoItem1Name"),
    t("demoItem2Name"),
    t("demoItem3Name"),
    t("demoItem4Name"),
    t("demoItem5Name"),
    t("demoItem6Name"),
  ];

  const qtyOf = (name: string) => {
    const map: Record<string, string> = {
      [t("demoItem1Name")]: t("demoItem1Qty"),
      [t("demoItem2Name")]: t("demoItem2Qty"),
      [t("demoItem3Name")]: t("demoItem3Qty"),
      [t("demoItem4Name")]: t("demoItem4Qty"),
      [t("demoItem5Name")]: t("demoItem5Qty"),
      [t("demoItem6Name")]: t("demoItem6Qty"),
    };
    return map[name];
  };

  const iconOf = (name: string) => DEMO_ICONS[Object.keys(DEMO_ICONS)[demoItems.indexOf(name)]] ?? "📦";

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="absolute right-0 top-24 h-80 w-80 rounded-full bg-teal-300/20 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-14 px-4 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
          <div className={`text-center ${dir === 'rtl' ? 'lg:text-right' : 'lg:text-left'}`}>
            <span className="badge mb-5 bg-emerald-100/80 px-4 py-1.5 text-emerald-700">
              ✨ {t("homeBadge")}
            </span>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-gray-900 md:text-5xl">
              {t("homeTitle1")}
              <br />
              <span className="bg-gradient-to-l from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {t("homeTitle2")}
              </span>{" "}
              {t("homeSubtitle")}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600 lg:mx-0">
              {t("homeDesc")}
            </p>

            <div className={`mt-8 flex flex-col gap-3 sm:flex-row ${dir === 'rtl' ? 'lg:justify-start' : 'lg:justify-start'}`}>
              <Link href="/register" className="btn-primary px-7 py-3 text-base">
                {t("ctaStartFree")}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {dir === 'rtl' ? <path d="M19 12H5m7-7-7 7 7 7" transform="scale(-1,1) translate(-24,0)" /> : <path d="M5 12h14m-7-7 7 7-7 7" />}
                </svg>
              </Link>
              <Link href="/pricing" className="btn-secondary px-7 py-3 text-base">
                {t("ctaViewPricing")}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500 lg:justify-start">
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                {t("featFree1")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                {t("featFree3")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">✓</span>
                {t("feat2Title")}
              </span>
            </div>
          </div>

          {/* Demo app window */}
          <div className="relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-500/15 to-teal-500/10 blur-xl" />
            <div className="card relative overflow-hidden !rounded-3xl">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-red-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                </div>
                <span className="badge bg-emerald-100 text-emerald-700">
                  {t("demoFridge")} · {6} {t("demoIngredients")}
                </span>
              </div>

              <div className="p-5">
                <div className="space-y-2">
                  {demoItems.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-3.5 py-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-base shadow-sm">
                        {iconOf(name)}
                      </span>
                      <span className="flex-1 truncate font-medium text-gray-800">{name}</span>
                      <span className="text-xs text-gray-400">{qtyOf(name)}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-primary mt-4 w-full py-3 text-base"
                >
                  {t("demoBtn")} ✨
                </button>
                <p className="mt-3 text-center text-xs text-gray-400">{t("demoNote")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
          {t("whyTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">{t("homeDesc")}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            { icon: "🧊", title: t("feat1Title"), desc: t("feat1Desc") },
            { icon: "⚡", title: t("feat2Title"), desc: t("feat2Desc") },
            { icon: "🔥", title: t("feat3Title"), desc: t("feat3Desc") },
          ].map((f) => (
            <div
              key={f.title}
              className="card card-hover group p-7 text-center transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-50 text-2xl transition-transform duration-200 group-hover:scale-110">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 px-6 py-14 text-center shadow-2xl shadow-emerald-600/30">
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl font-bold tracking-tight text-white">
            {t("ctaBottomTitle")}
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-lg text-emerald-50">
            {t("ctaBottomDesc")}
          </p>
          <Link
            href="/register"
            className="btn relative mt-8 bg-white px-8 py-3 text-base text-emerald-700 shadow-lg hover:bg-emerald-50"
          >
            {t("ctaBottomBtn")}
          </Link>
        </div>
      </section>
    </div>
  );
}
