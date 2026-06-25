import { Suspense } from "react";
import Link from "next/link";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import TopNav from "../components/top-nav";
import MiniAppLaunchClient from "../components/miniapp-launch-client";
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
  title: "BOSE",
  description:
    "Business OS Engine for Telegram-first teams, with BOSE core entities, Mini App workflows, and Furneq as the first live module."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const lang = await getLanguage();

  return (
    <html lang={lang}>
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <MiniAppLaunchClient />
        <div className="app-frame">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-mark">BO</span>
              <div>
                <strong>BOSE</strong>
                <small>
                  {pick(
                    lang,
                    "Business OS Engine for Telegram-first operations",
                    "Business OS Engine для Telegram-first операций"
                  )}
                </small>
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
