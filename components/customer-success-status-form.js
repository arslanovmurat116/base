"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

const STATUS_OPTIONS = [
  ["FIRST_WEEK", "First week", "Первая неделя"],
  ["ADOPTION_CHECK", "Adoption check", "Проверка внедрения"],
  ["EXPANSION", "Expansion", "Расширение"],
  ["RENEWAL_REVIEW", "Renewal review", "Продление"],
  ["RENEWED", "Renewed", "Продлено"],
  ["AT_RISK", "At risk", "Риск оттока"]
];

export default function CustomerSuccessStatusForm({
  successId,
  currentStatus = "FIRST_WEEK",
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
      const response = await fetch("/api/customer-success/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: successId,
          status,
          successNote: note
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Success loop updated", "Контур обновлён"));

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
          "What is the next retention or renewal move",
          "Какой следующий шаг по удержанию или продлению"
        )}
        type="text"
        value={note}
      />
      <button className="ghost-button" disabled={pending} onClick={handleSubmit} type="button">
        {pending
          ? pick(lang, "Saving...", "Сохраняем...")
          : pick(lang, "Update success", "Обновить сопровождение")}
      </button>
      {feedback ? <small className="inline-feedback">{feedback}</small> : null}
    </div>
  );
}
