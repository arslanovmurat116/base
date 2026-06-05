"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeadProjectFileDeleteButton({ slug, slot, title }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(`Удалить файл из слота «${title}»?`);

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
        throw new Error(result?.message || "Не удалось удалить файл");
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
      {pending ? "Удаляем..." : "Удалить"}
    </button>
  );
}
