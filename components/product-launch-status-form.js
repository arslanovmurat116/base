"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

const STATUS_OPTIONS = [
  ["KICKOFF_PENDING", "Kickoff pending", "Ждёт kickoff"],
  ["ACCESS_SETUP", "Access setup", "Доступы и setup"],
  ["TEAM_SETUP", "Team setup", "Команда и данные"],
  ["TRAINING", "Training", "Обучение"],
  ["LIVE", "Live", "Запущено"],
  ["BLOCKED", "Blocked", "Есть блокер"]
];

export default function ProductLaunchStatusForm({
  launchId,
  currentStatus = "KICKOFF_PENDING",
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
      const response = await fetch("/api/launches/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: launchId,
          status,
          handoffNote: note
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Launch updated", "Запуск обновлён"));

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
          "What is needed to get this workshop live",
          "Что нужно, чтобы довести этот цех до запуска"
        )}
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleSubmit} type="button">
        {pending
          ? pick(lang, "Saving...", "Сохраняем...")
          : pick(lang, "Update launch", "Обновить запуск")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
