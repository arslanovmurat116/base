import { Suspense } from "react";
import Link from "next/link";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import TopNav from "../components/top-nav";
import MiniAppLaunchClient from "../components/miniapp-launch-client";
import { pick } from "../lib/i18n";
import { getLanguage } from "../lib/i18n-server";
import { getOwnerAccessState } from "../lib/owner-access-server";

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
  description: "BOSE is a Telegram-first business workspace for clients, deals, tasks, analytics, and AI guidance."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const lang = await getLanguage();
  const ownerAccess = await getOwnerAccessState();

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
                  {pick(lang, "Business OS Engine for Telegram workspaces", "Операционная система для Telegram-рабочих пространств")}
                </small>
              </div>
            </Link>
            <Suspense fallback={null}>
              <TopNav lang={lang} ownerMode={ownerAccess.isOwner} />
            </Suspense>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
