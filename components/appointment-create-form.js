"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

export default function AppointmentCreateForm({
  lang = "en",
  initialLead = "",
  initialOwner = "",
  title,
  description
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
      setFeedback(result.message || pick(lang, "Appointment saved", "Замер назначен"));

      if (response.ok) {
        setScheduledAt("");
        setLocation("");
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
        <p className="eyebrow">{pick(lang, "Appointment", "Замер")}</p>
        <h2>{title || pick(lang, "Book an appointment", "Назначить замер")}</h2>
        <p>
          {description ||
            pick(
              lang,
              "Create a measurement, showroom visit or consultation so the team sees the next step in one place.",
              "Зафиксируй замер, выезд в шоурум или консультацию, чтобы команда держала под контролем следующий шаг по сделке."
            )}
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="outcome-grid">
          <label className="field-block">
            <span>{pick(lang, "Client", "Клиент")}</span>
            <input onChange={(event) => setLead(event.target.value)} type="text" value={lead} />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Owner / measurer", "Замерщик / ответственный")}</span>
            <input onChange={(event) => setOwner(event.target.value)} type="text" value={owner} />
          </label>
        </div>

        <div className="outcome-grid">
          <label className="field-block">
            <span>{pick(lang, "Appointment type", "Формат замера или встречи")}</span>
            <select onChange={(event) => setType(event.target.value)} value={type}>
              <option value="measurement">{pick(lang, "On-site measurement", "Замер на объекте")}</option>
              <option value="showroom">{pick(lang, "Showroom", "Шоурум")}</option>
              <option value="consultation">{pick(lang, "Consultation", "Консультация")}</option>
              <option value="call">{pick(lang, "Call", "Созвон")}</option>
              <option value="custom">{pick(lang, "Other", "Другое")}</option>
            </select>
          </label>

          <label className="field-block">
            <span>{pick(lang, "Duration, minutes", "Длительность, минут")}</span>
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
          <span>{pick(lang, "Date and time", "Дата и время")}</span>
          <input
            onChange={(event) => setScheduledAt(event.target.value)}
            type="datetime-local"
            value={scheduledAt}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Address or location", "Адрес или площадка")}</span>
          <input
            onChange={(event) => setLocation(event.target.value)}
            placeholder={pick(lang, "For example: site address, showroom, Zoom or phone call", "Например: адрес объекта, шоурум, Zoom или телефонный созвон")}
            type="text"
            value={location}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Notes for the visit", "Что важно по замеру")}</span>
          <textarea
            onChange={(event) => setNote(event.target.value)}
            placeholder={pick(lang, "For example: check appliance niche, show finishes, discuss budget", "Например: проверить нишу под технику, показать фасады, обсудить бюджет")}
            rows={3}
            value={note}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save appointment", "Назначить замер")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
