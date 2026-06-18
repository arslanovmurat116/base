"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function LeadProjectFileDeleteButton({ slug, slot, title, lang = "en" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      pick(lang, `Delete file from slot "${title}"?`, `Удалить файл из слота «${title}»?`)
    );

    if (!confirmed) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch(`/api/leads/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "project-file-delete",
          slot
        })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.message || pick(lang, "Failed to delete file", "Не удалось удалить файл"));
      }

      router.refresh();
    } catch (error) {
      window.alert(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className="ghost-button"
      disabled={pending}
      onClick={handleDelete}
      type="button"
    >
      {pending ? pick(lang, "Deleting...", "Удаляем...") : pick(lang, "Delete", "Удалить")}
    </button>
  );
}
