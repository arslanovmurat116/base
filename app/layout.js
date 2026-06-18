import { Suspense } from "react";
import Link from "next/link";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import TopNav from "../components/top-nav";
import { pick } from "../lib/i18n";
import { getLanguage } from "../lib/i18n-server";

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body"
});

const displayFont = Lora({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display"
});

export const metadata = {
  title: "Furneq",
  description:
    "AI workflow for custom furniture orders: leads, measurements, estimates, production and team control."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const lang = await getLanguage();

  return (
    <html lang={lang}>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="app-frame">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-mark">FQ</span>
              <div>
                <strong>Furneq</strong>
                <small>{pick(lang, "AI workspace for custom furniture orders", "AI-система для мебельных заказов")}</small>
              </div>
            </Link>
            <Suspense fallback={null}>
              <TopNav lang={lang} />
            </Suspense>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
