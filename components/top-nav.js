"use client";

import { usePathname } from "next/navigation";
import LanguageToggle from "./language-toggle";
import TrackedLink from "./tracked-link";

export default function TopNav({ lang = "en" }) {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: lang === "ru" ? "Главная" : "Home" },
    { href: "/dashboard", label: lang === "ru" ? "Панель" : "Dashboard" },
    { href: "/clients", label: lang === "ru" ? "Клиенты" : "Clients" },
    { href: "/deals", label: lang === "ru" ? "Сделки" : "Deals" },
    { href: "/tasks", label: lang === "ru" ? "Задачи" : "Tasks" },
    { href: "/ai", label: "AI" }
  ];

  return (
    <div className="topnav-shell">
      <nav className="topnav">
        {navItems.map((item) => (
          <TrackedLink
            key={item.href}
            href={item.href}
            eventLabel={item.label}
            eventSource="topnav"
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
          </TrackedLink>
        ))}
      </nav>
      <LanguageToggle lang={lang} />
    </div>
  );
}
