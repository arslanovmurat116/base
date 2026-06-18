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
    "Telegram CRM for furniture workshops: client requests, measurements, estimates, deposits and workshop control."
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
                <small>{pick(lang, "Telegram CRM for furniture workshops", "Telegram CRM для мебельных цехов")}</small>
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
