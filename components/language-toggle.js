"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APP_LANGUAGE_COOKIE } from "../lib/i18n";

export default function LanguageToggle({ lang = "en" }) {
  const router = useRouter();
  const [activeLang, setActiveLang] = useState(lang);
  const [isPending, startTransition] = useTransition();

  function changeLanguage(nextLang) {
    if (nextLang === activeLang || isPending) {
      return;
    }

    startTransition(async () => {
      document.cookie = `${APP_LANGUAGE_COOKIE}=${nextLang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      setActiveLang(nextLang);
      router.refresh();
    });
  }

  return (
    <div className="language-toggle" aria-label="Language switch">
      {[
        { value: "en", label: "EN" },
        { value: "ru", label: "RU" }
      ].map((item) => (
        <button
          className={item.value === activeLang ? "language-pill language-pill-active" : "language-pill"}
          disabled={isPending}
          key={item.value}
          onClick={() => changeLanguage(item.value)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
