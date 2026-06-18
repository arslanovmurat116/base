"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function FollowupCreateForm({
  lang = "en",
  initialLead = "",
  initialOwner = "",
  title,
  description
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [owner, setOwner] = useState(initialOwner);
  const [type, setType] = useState("call");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/followups/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lead,
          owner,
          type,
          scheduledAt,
          note
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Follow-up created", "Повторный контакт создан"));

      if (response.ok) {
        setScheduledAt("");
        setNote("");
        router.refresh();
      }
    } catch (error) {
      setFeedback(`${pick(lang, "Form error", "Ошибка формы")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel workflow-form-panel">
      <div className="section-title">
        <p className="eyebrow">{pick(lang, "Follow-up", "Возврат")}</p>
        <h2>{title || pick(lang, "Create a follow-up", "Создать повторный контакт")}</h2>
        <p>
          {description ||
            pick(
              lang,
              "Create the next callback directly in the system so warm deals do not disappear after estimate, measurement or quote.",
              "Фиксируй повторный контакт сразу в системе, чтобы тёплые сделки не терялись после расчёта, замера или КП."
            )}
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>{pick(lang, "Client", "Клиент")}</span>
          <input
            type="text"
            value={lead}
            onChange={(event) => setLead(event.target.value)}
            placeholder={pick(lang, "For example: Samat R.", "Например: Самат Р.")}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Owner", "Ответственный")}</span>
          <input
            type="text"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder={pick(lang, "For example: Timur", "Например: Тимур")}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Follow-up type", "Тип возврата")}</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="call">{pick(lang, "Call", "Позвонить")}</option>
            <option value="message">{pick(lang, "Message", "Написать")}</option>
            <option value="proposal">{pick(lang, "After estimate", "Вернуться после расчёта")}</option>
            <option value="meeting">{pick(lang, "After measurement", "Вернуться после замера")}</option>
            <option value="custom">{pick(lang, "Other", "Другое")}</option>
          </select>
        </label>

        <label className="field-block">
          <span>{pick(lang, "Date and time", "Дата и время")}</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "What needs to be done", "Что именно нужно сделать")}</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={pick(lang, "For example: review the quote, clear installation timing, confirm the visit", "Например: пройтись по КП, снять вопрос по срокам установки, подтвердить замер")}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Creating...", "Создаём...") : pick(lang, "Create follow-up", "Создать возврат")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
