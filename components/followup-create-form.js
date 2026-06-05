"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FollowupCreateForm({
  initialLead = "",
  initialOwner = "",
  title = "Создать повторный контакт",
  description = "Фиксируй повторный контакт сразу в системе, чтобы тёплые сделки не терялись после расчёта, замера или КП."
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
      setFeedback(result.message || "Повторный контакт создан");

      if (response.ok) {
        setScheduledAt("");
        setNote("");
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка формы: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel workflow-form-panel">
      <div className="section-title">
        <p className="eyebrow">Возврат</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>Клиент</span>
          <input
            type="text"
            value={lead}
            onChange={(event) => setLead(event.target.value)}
            placeholder="Например: Самат Р."
          />
        </label>

        <label className="field-block">
          <span>Ответственный</span>
          <input
            type="text"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="Например: Тимур"
          />
        </label>

        <label className="field-block">
          <span>Тип возврата</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="call">Позвонить</option>
            <option value="message">Написать</option>
            <option value="proposal">Вернуться после расчёта</option>
            <option value="meeting">Вернуться после замера</option>
            <option value="custom">Другое</option>
          </select>
        </label>

        <label className="field-block">
          <span>Дата и время</span>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => setScheduledAt(event.target.value)}
          />
        </label>

        <label className="field-block">
          <span>Что именно нужно сделать</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например: пройтись по КП, снять вопрос по срокам установки, подтвердить замер"
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Создаём..." : "Создать возврат"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
