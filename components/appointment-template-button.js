"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function AppointmentTemplateButton({ id, lang = "en", templateKey, label }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSend() {
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/appointments/send-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          templateKey
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Template sent", "Шаблон отправлен"));

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedback(`${pick(lang, "Error", "Ошибка")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="task-action-row">
      <button className="ghost-button" disabled={pending} onClick={handleSend} type="button">
        {pending ? pick(lang, "Sending...", "Отправляем...") : label}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
