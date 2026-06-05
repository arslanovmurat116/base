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
  title: "Mebel RDN CRM",
  description: "CRM мебельного цеха: заявки, замеры, расчёты, предоплата и запуск в производство"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <div className="app-frame">
          <header className="topbar">
            <Link className="brand" href="/">
              <span className="brand-mark">DM</span>
              <div>
                <strong>Mebel RDN CRM</strong>
                <small>Заявки, замеры, расчёты и контроль заказа в одном контуре</small>
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
