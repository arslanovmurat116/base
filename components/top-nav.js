"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "../lib/mock-data";

export default function TopNav() {
  const pathname = usePathname();

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
    </div>
  );
}
