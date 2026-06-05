"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function formatStatusLabel(status) {
  switch (status) {
    case "NEW":
      return "Новая заявка";
    case "CONTACTED":
      return "Связаться";
    case "QUALIFIED":
      return "Расчёт стоимости";
    case "MEETING":
      return "Замер назначен";
    case "PROPOSAL":
      return "Согласование";
    case "WON":
      return "Предоплата получена";
    case "LOST":
      return "Отказ";
    default:
      return status;
  }
}

export default function LeadWorkflowForm({
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
      setFeedback(result.message || "Изменения сохранены");

      if (response.ok) {
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
        <p className="eyebrow">Этап сделки</p>
        <h2>Обновить статус и следующий шаг</h2>
        <p>
          Этот блок нужен, чтобы менеджер не держал следующий шаг “в голове”.
          Здесь мы фиксируем, на каком этапе реально стоит мебельная сделка:
          нужно ли ещё связаться, назначить замер, подготовить расчёт,
          согласовать решение или дойти до предоплаты.
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <label className="field-block">
          <span>Статус сделки</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {formatStatusLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="field-block">
          <span>Следующий шаг</span>
          <textarea
            rows={4}
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Например: подтвердить адрес замера, выдать расчёт, обсудить предоплату"
          />
        </label>

        <label className="field-block">
          <span>Причина потери</span>
          <input
            type="text"
            value={lossReason}
            onChange={(event) => setLossReason(event.target.value)}
            placeholder="Нужно только если переводим сделку в потерю"
          />
        </label>

        <label className="field-block">
          <span>Когда вернуться к клиенту</span>
          <input
            type="datetime-local"
            value={followupAt}
            onChange={(event) => setFollowupAt(event.target.value)}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Сохраняем..." : "Сохранить изменения"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
