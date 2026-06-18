"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageToggle from "./language-toggle";

export default function TopNav({ lang = "en" }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: lang === "ru" ? "Главная" : "Home" },
    { href: "/workboard", label: lang === "ru" ? "Смена" : "Workboard" },
    { href: "/leads", label: lang === "ru" ? "Сделки" : "Deals" },
    { href: "/appointments", label: lang === "ru" ? "Замеры" : "Appointments" }
  ];

  return (
    <div className="topnav-shell">
      <nav className="topnav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.href === "/"
                ? pathname === "/"
                  ? "topnav-active"
                  : undefined
                : pathname.startsWith(item.href)
                  ? "topnav-active"
                  : undefined
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <LanguageToggle lang={lang} />
    </div>
  );
}
