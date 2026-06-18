"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function AppointmentStatusForm({ id, lang = "en", status: initialStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus || "SCHEDULED");
  const [note, setNote] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/appointments/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id,
          status,
          note,
          revenueAmount
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Appointment updated", "Статус замера обновлён"));

      if (response.ok) {
        setNote("");
        setRevenueAmount("");
        router.refresh();
      }
    } catch (error) {
      setFeedback(`${pick(lang, "Error", "Ошибка")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="task-action-row appointment-action-form" onSubmit={handleSubmit}>
      <select
        className="inline-status-select"
        disabled={pending}
        onChange={(event) => setStatus(event.target.value)}
        value={status}
      >
        {[
          { value: "SCHEDULED", label: pick(lang, "Scheduled", "Назначено") },
          { value: "CONFIRMED", label: pick(lang, "Confirmed", "Подтверждено") },
          { value: "COMPLETED", label: pick(lang, "Completed", "Проведено") },
          { value: "CANCELLED", label: pick(lang, "Cancelled", "Отменено") },
          { value: "NO_SHOW", label: pick(lang, "No-show", "Не состоялось") }
        ].map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        placeholder={pick(lang, "What happened during the visit", "Что произошло по замеру или выезду")}
        type="text"
        value={note}
      />
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setRevenueAmount(event.target.value)}
        placeholder={pick(lang, "Deposit after the visit", "Предоплата после замера")}
        type="number"
        value={revenueAmount}
      />
      <button className="ghost-button" disabled={pending} type="submit">
        {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save", "Сохранить")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </form>
  );
}
