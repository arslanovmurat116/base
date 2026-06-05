"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function buildHref(pathname, params, key, value) {
  const next = new URLSearchParams(params.toString());

  if (!value || value === "all") {
    next.delete(key);
  } else {
    next.set(key, value);
  }

  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function FilterBar({ title, paramKey, options }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const activeValue = params.get(paramKey) || "all";

  return (
    <div className="filter-bar">
      <span className="filter-title">{title}</span>
      <div className="filter-pills">
        {options.map((option) => (
          <Link
            key={option.value}
            href={buildHref(pathname, params, paramKey, option.value)}
            className={
              activeValue === option.value
                ? "filter-pill filter-pill-active"
                : "filter-pill"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
