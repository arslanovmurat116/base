"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

const STATUS_OPTIONS = [
  ["NEW", "New", "Новая"],
  ["CONTACTED", "Contacted", "Связались"],
  ["DEMO_BOOKED", "Demo booked", "Демо назначено"],
  ["PILOT_ACTIVE", "Pilot active", "Пилот запущен"],
  ["WON", "Won", "Продано"],
  ["LOST", "Lost", "Потеряно"]
];

export default function PilotRequestStatusForm({
  requestId,
  currentStatus = "NEW",
  currentNote = "",
  lang = "en"
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState(currentNote);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit() {
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/pilots/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: requestId,
          status,
          internalNote: note
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Pilot request updated", "Статус пилота обновлён"));

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
    <div className="task-action-row pilot-action-row">
      <select
        className="inline-status-select"
        disabled={pending}
        onChange={(event) => setStatus(event.target.value)}
        value={status}
      >
        {STATUS_OPTIONS.map(([value, englishLabel, russianLabel]) => (
          <option key={value} value={value}>
            {pick(lang, englishLabel, russianLabel)}
          </option>
        ))}
      </select>
      <input
        className="inline-note-input"
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
        placeholder={pick(
          lang,
          "What happened after the last contact",
          "Что произошло после последнего контакта"
        )}
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleSubmit} type="button">
        {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Update pilot", "Обновить пилот")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
