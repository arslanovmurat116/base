import { Suspense } from "react";
import Link from "next/link";
import { Lora, Manrope } from "next/font/google";
import "./globals.css";
import TopNav from "../components/top-nav";

const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body"
});

const displayFont = Lora({
  subsets: ["latin", "cyrillic"],
  variable: "--font-display"
});

export const metadata = {
  title: "Mebel RDN Mini App",
  description:
    "Telegram Mini App для мебельного бизнеса: заявки, консультация, дожим до предоплаты и контроль цеха по подписке."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="app-frame">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-mark">MR</span>
              <div>
                <strong>Mebel RDN Mini App</strong>
                <small>Telegram-система для заявок, дожима до продажи и контроля мебельного цеха</small>
              </div>
            </Link>
            <Suspense fallback={null}>
              <TopNav />
            </Suspense>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
