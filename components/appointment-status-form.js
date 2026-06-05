"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Назначено" },
  { value: "CONFIRMED", label: "Подтверждено" },
  { value: "COMPLETED", label: "Проведено" },
  { value: "CANCELLED", label: "Отменено" },
  { value: "NO_SHOW", label: "Не состоялось" }
];

export default function AppointmentStatusForm({ id, status: initialStatus }) {
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
      setFeedback(result.message || "Статус замера обновлён");

      if (response.ok) {
        setNote("");
        setRevenueAmount("");
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка: ${error.message}`);
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
        {STATUS_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Что произошло по замеру или выезду"
        type="text"
        value={note}
      />
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setRevenueAmount(event.target.value)}
        placeholder="Предоплата после замера"
        type="number"
        value={revenueAmount}
      />
      <button className="ghost-button" disabled={pending} type="submit">
        {pending ? "Сохраняем..." : "Сохранить"}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </form>
  );
}
