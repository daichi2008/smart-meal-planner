'use client'

import Link from "next/link";

import { useI18n } from "@/lib/i18n";

export default function Home() {
  const { t, dir } = useI18n();

  return (
    <div>
      <section className="bg-gradient-to-b from-emerald-50 to-gray-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-2 md:items-center">
          <div className={`text-center ${dir === 'rtl' ? 'md:text-right' : 'md:text-left'}`}>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              ✨ {t("homeBadge")}
            </span>
            <h1 className="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
              {t("homeTitle1")}
              <br />
              <span className="text-emerald-600">{t("homeTitle2")}</span>{" "}
              {t("homeSubtitle")}
            </h1>
            <p className="mt-4 text-lg text-gray-600">{t("homeDesc")}</p>
            <div className={`mt-8 flex flex-col justify-center gap-3 sm:flex-row ${dir === 'rtl' ? 'md:justify-start' : 'md:justify-start'}`}>
              <Link
                href="/register"
                className="rounded-xl bg-emerald-600 px-6 py-3 text-center text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
              >
                {t("ctaStartFree")}
              </Link>
              <Link
                href="/pricing"
                className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-center text-base font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                {t("ctaViewPricing")}
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{t("demoFridge")} 🧊</h2>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                6 {t("demoIngredients")}
              </span>
            </div>
            <div className="space-y-2">
              {[
                [t("demoItem1Name"), t("demoItem1Qty")],
                [t("demoItem2Name"), t("demoItem2Qty")],
                [t("demoItem3Name"), t("demoItem3Qty")],
                [t("demoItem4Name"), t("demoItem4Qty")],
                [t("demoItem5Name"), t("demoItem5Qty")],
                [t("demoItem6Name"), t("demoItem6Qty")],
              ].map(([name, qty]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5"
                >
                  <span className="font-medium text-gray-800">{name}</span>
                  <span className="text-sm text-gray-500">{qty}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              {t("demoBtn")} ✨
            </button>
            <p className="mt-3 text-center text-sm text-gray-500">{t("demoNote")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-3xl font-bold text-gray-900">{t("whyTitle")}</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { icon: "🧊", title: t("feat1Title"), desc: t("feat1Desc") },
            { icon: "⚡", title: t("feat2Title"), desc: t("feat2Desc") },
            { icon: "🔥", title: t("feat3Title"), desc: t("feat3Desc") },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm"
            >
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-3xl">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900">{t("ctaBottomTitle")}</h2>
          <p className="mt-3 text-lg text-gray-600">{t("ctaBottomDesc")}</p>
          <Link
            href="/register"
            className="mt-6 inline-block rounded-xl bg-emerald-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
          >
            {t("ctaBottomBtn")}
          </Link>
        </div>
      </section>
    </div>
  );
}
