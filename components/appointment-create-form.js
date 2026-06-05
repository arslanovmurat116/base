"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AppointmentCreateForm({
  initialLead = "",
  initialOwner = "",
  title = "Назначить замер",
  description = "Зафиксируй замер, выезд в шоурум или консультацию, чтобы команда держала под контролем следующий шаг по сделке."
}) {
  const router = useRouter();
  const [lead, setLead] = useState(initialLead);
  const [owner, setOwner] = useState(initialOwner);
  const [type, setType] = useState("measurement");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          lead,
          owner,
          type,
          scheduledAt,
          durationMinutes,
          location,
          note
        })
      });

      const result = await response.json();
      setFeedback(result.message || "Замер назначен");

      if (response.ok) {
        setScheduledAt("");
        setLocation("");
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
        <p className="eyebrow">Замер</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="outcome-grid">
          <label className="field-block">
            <span>Клиент</span>
            <input onChange={(event) => setLead(event.target.value)} type="text" value={lead} />
          </label>

          <label className="field-block">
            <span>Замерщик / ответственный</span>
            <input onChange={(event) => setOwner(event.target.value)} type="text" value={owner} />
          </label>
        </div>

        <div className="outcome-grid">
          <label className="field-block">
            <span>Формат замера или встречи</span>
            <select onChange={(event) => setType(event.target.value)} value={type}>
              <option value="measurement">Замер на объекте</option>
              <option value="showroom">Шоурум</option>
              <option value="consultation">Консультация</option>
              <option value="call">Созвон</option>
              <option value="custom">Другое</option>
            </select>
          </label>

          <label className="field-block">
            <span>Длительность, минут</span>
            <input
              min="15"
              onChange={(event) => setDurationMinutes(event.target.value)}
              step="15"
              type="number"
              value={durationMinutes}
            />
          </label>
        </div>

        <label className="field-block">
          <span>Дата и время</span>
          <input
            onChange={(event) => setScheduledAt(event.target.value)}
            type="datetime-local"
            value={scheduledAt}
          />
        </label>

        <label className="field-block">
          <span>Адрес или площадка</span>
          <input
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Например: адрес объекта, шоурум, Zoom или телефонный созвон"
            type="text"
            value={location}
          />
        </label>

        <label className="field-block">
          <span>Что важно по замеру</span>
          <textarea
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например: проверить нишу под технику, показать фасады, обсудить бюджет"
            rows={3}
            value={note}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Сохраняем..." : "Назначить замер"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
