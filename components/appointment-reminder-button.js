"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function AppointmentReminderButton({ id, lang = "en" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleReminder() {
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/appointments/remind", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Reminder sent", "Напоминание отправлено"));

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
      <button className="ghost-button" disabled={pending} onClick={handleReminder} type="button">
        {pending ? pick(lang, "Sending...", "Отправляем...") : pick(lang, "Send reminder", "Отправить напоминание")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
