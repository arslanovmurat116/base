"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

function formatStatusLabel(status, lang) {
  switch (status) {
    case "NEW":
      return pick(lang, "New lead", "Новая заявка");
    case "CONTACTED":
      return pick(lang, "Contact", "Связаться");
    case "QUALIFIED":
      return pick(lang, "Estimate", "Расчёт стоимости");
    case "MEETING":
      return pick(lang, "Measurement booked", "Замер назначен");
    case "PROPOSAL":
      return pick(lang, "Approval", "Согласование");
    case "WON":
      return pick(lang, "Deposit received", "Предоплата получена");
    case "LOST":
      return pick(lang, "Lost", "Отказ");
    default:
      return status;
  }
}

export default function LeadWorkflowForm({
  lang = "en",
  slug,
  initialStatus,
  initialNextAction,
  statusOptions
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [nextAction, setNextAction] = useState(initialNextAction);
  const [lossReason, setLossReason] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch(`/api/leads/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status,
          nextAction,
          lossReason,
          followupAt
        })
      });

      const result = await response.json();
      setFeedback(result.message || pick(lang, "Changes saved", "Изменения сохранены"));

      if (response.ok) {
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
        <p className="eyebrow">{pick(lang, "Deal stage", "Этап сделки")}</p>
        <h2>{pick(lang, "Update status and next step", "Обновить статус и следующий шаг")}</h2>
        <p>
          {pick(
            lang,
            "Use this block to keep the next step visible: contact, measurement, estimate, approval or deposit.",
            "Этот блок нужен, чтобы менеджер не держал следующий шаг в голове: контакт, замер, расчёт, согласование или предоплата."
          )}
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>{pick(lang, "Deal status", "Статус сделки")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {formatStatusLabel(item, lang)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-block">
          <span>{pick(lang, "Next step", "Следующий шаг")}</span>
          <textarea
            rows={4}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder={pick(lang, "For example: confirm address, send estimate, discuss deposit", "Например: подтвердить адрес замера, выдать расчёт, обсудить предоплату")}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Loss reason", "Причина потери")}</span>
          <input
            type="text"
            value={lossReason}
            onChange={(event) => setLossReason(event.target.value)}
            placeholder={pick(lang, "Only needed if the deal is lost", "Нужно только если переводим сделку в потерю")}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Follow up at", "Когда вернуться к клиенту")}</span>
          <input
            type="datetime-local"
            value={followupAt}
            onChange={(event) => setFollowupAt(event.target.value)}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save changes", "Сохранить изменения")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
