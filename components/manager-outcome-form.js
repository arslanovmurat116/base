"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";

function getOutcomes(lang) {
  return [
    {
      value: "replied",
      label: pick(lang, "In progress", "В работе"),
      status: "CONTACTED",
      hint: pick(lang, "The manager already replied and is moving the client forward.", "Менеджер уже вышел на связь и двигает клиента дальше.")
    },
    {
      value: "awaiting_response",
      label: pick(lang, "Waiting for reply", "Ждём ответ"),
      status: "CONTACTED",
      hint: pick(lang, "The contact happened, now a follow-up or a callback is needed.", "Контакт был, теперь нужен follow-up или возврат.")
    },
    {
      value: "qualified",
      label: pick(lang, "Brief collected", "Бриф собран"),
      status: "QUALIFIED",
      hint: pick(lang, "The request is clear and ready for estimate work.", "Запрос понятен и готов к расчёту.")
    },
    {
      value: "meeting_booked",
      label: pick(lang, "Measurement booked", "Замер назначен"),
      status: "MEETING",
      hint: pick(lang, "A visit, showroom meeting or consultation is already booked.", "Выезд, встреча или консультация уже назначены.")
    },
    {
      value: "proposal_sent",
      label: pick(lang, "Estimate sent", "КП отправлено"),
      status: "PROPOSAL",
      hint: pick(lang, "The client already has the numbers, now the deal needs follow-through.", "Клиент уже получил расчёт, теперь нужен дожим.")
    },
    {
      value: "won",
      label: pick(lang, "Deposit received", "Предоплата получена"),
      status: "WON",
      hint: pick(lang, "The client confirmed the deal and moved to money.", "Клиент подтвердил условия и дошёл до денег.")
    },
    {
      value: "lost",
      label: pick(lang, "Lost", "Отказ"),
      status: "LOST",
      hint: pick(lang, "Keep a clear loss reason so the team can learn from it later.", "Лучше честно зафиксировать потерю, чем гадать потом.")
    }
  ];
}

function getTrackPresets(requestTrack, lang) {
  const data = {
    booking: [
      {
        label: pick(lang, "Ready for measurement", "Готов к замеру"),
        outcome: "meeting_booked",
        note: pick(lang, "The client agreed to a visit. Confirm the slot and address.", "Клиент согласовал выезд. Нужно подтвердить слот и адрес."),
        nextAction: pick(lang, "Confirm address, time and contact person on site", "Подтвердить адрес, время и контакт на объекте")
      },
      {
        label: pick(lang, "Needs another slot", "Нужен другой слот"),
        outcome: "awaiting_response",
        note: pick(lang, "The client is interested but the current visit time does not fit.", "Интерес есть, но текущее окно выезда не подходит."),
        nextAction: pick(lang, "Offer two or three alternative visit windows", "Предложить два-три альтернативных окна для выезда")
      }
    ],
    estimate: [
      {
        label: pick(lang, "Estimate needed", "Нужен расчёт"),
        outcome: "qualified",
        note: pick(lang, "Inputs are collected, now the team needs to prepare pricing.", "Вводные собраны, теперь нужен расчёт."),
        nextAction: pick(lang, "Prepare estimate and send it on time", "Подготовить расчёт и отправить в обещанный срок")
      },
      {
        label: pick(lang, "Quote sent", "КП отправлено"),
        outcome: "proposal_sent",
        note: pick(lang, "The client has the estimate, now keep the pace.", "Клиент уже получил расчёт, теперь важно не потерять темп."),
        nextAction: pick(lang, "Come back after the quote and walk through open questions", "Вернуться после КП и пройтись по вопросам")
      }
    ],
    consultation: [
      {
        label: pick(lang, "Ready for consultation", "Готов к консультации"),
        outcome: "meeting_booked",
        note: pick(lang, "The client is ready for a short call before measurement or estimate.", "Клиент готов к короткой консультации перед замером или расчётом."),
        nextAction: pick(lang, "Book the consultation and send the meeting frame", "Назначить консультацию и отправить рамку встречи")
      }
    ],
    explore: [
      {
        label: pick(lang, "Still exploring", "Пока изучает"),
        outcome: "replied",
        note: pick(lang, "The client is comparing options and not ready to decide today.", "Клиент пока сравнивает варианты и не готов решать сегодня."),
        nextAction: pick(lang, "Send examples and set a soft follow-up", "Отправить примеры и поставить мягкий возврат")
      }
    ]
  };

  return data[requestTrack] || [];
}

function formatLeadStatus(status, lang) {
  switch (status) {
    case "CONTACTED":
      return pick(lang, "Contact", "Связаться");
    case "QUALIFIED":
      return pick(lang, "Estimate", "Расчёт");
    case "MEETING":
      return pick(lang, "Measurement", "Замер");
    case "PROPOSAL":
      return pick(lang, "Approval", "Согласование");
    case "WON":
      return pick(lang, "Deposit / production", "Предоплата / производство");
    case "LOST":
      return pick(lang, "Lost", "Отказ");
    default:
      return status;
  }
}

export default function ManagerOutcomeForm({
  slug,
  initialStatus,
  requestTrack,
  lang = "en"
}) {
  const router = useRouter();
  const outcomes = useMemo(() => getOutcomes(lang), [lang]);
  const presets = useMemo(() => getTrackPresets(requestTrack, lang), [requestTrack, lang]);
  const [outcome, setOutcome] = useState("awaiting_response");
  const [status, setStatus] = useState(initialStatus || "CONTACTED");
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const matched = outcomes.find((item) => item.value === outcome);

    if (matched?.status) {
      setStatus(matched.status);
    }
  }, [outcome, outcomes]);

  function applyPreset(preset) {
    setOutcome(preset.outcome);
    setNote(preset.note);
    setNextAction(preset.nextAction);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch(`/api/leads/${slug}/outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          outcome,
          status,
          note,
          nextAction,
          followupAt
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || pick(lang, "Failed to save contact result", "Не удалось сохранить исход контакта"));
      }

      setFeedback(pick(lang, "Contact result saved", "Исход контакта сохранён"));
      setNote("");
      setNextAction("");
      setFollowupAt("");
      router.refresh();
    } catch (error) {
      setFeedback(`${pick(lang, "Form error", "Ошибка формы")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  const activeOutcome =
    outcomes.find((item) => item.value === outcome) || outcomes[0];

  return (
    <section className="panel workflow-form-panel outcome-form-panel">
      <div className="section-title">
        <p className="eyebrow">{pick(lang, "Contact", "Контакт")}</p>
        <h2>{pick(lang, "Save call result", "Зафиксировать исход общения")}</h2>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        {presets.length ? (
          <div className="outcome-preset-row">
            {presets.map((preset) => (
              <button
                className="outcome-preset-chip"
                disabled={pending}
                key={preset.label}
                onClick={() => applyPreset(preset)}
                type="button"
              >
                {preset.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="outcome-chip-row">
          {outcomes.map((item) => (
            <button
              className={`outcome-chip${item.value === outcome ? " outcome-chip-active" : ""}`}
              disabled={pending}
              key={item.value}
              onClick={() => setOutcome(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <p className="outcome-hint">{activeOutcome.hint}</p>

        <div className="outcome-grid">
          <label className="field-block">
            <span>{pick(lang, "Contact result", "Итог контакта")}</span>
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              {outcomes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>{pick(lang, "Deal status", "Новый статус")}</span>
            <input disabled type="text" value={formatLeadStatus(status, lang)} />
          </label>
        </div>

        <label className="field-block">
          <span>{pick(lang, "Manager note", "Что сделал менеджер")}</span>
          <textarea
            onChange={(event) => setNote(event.target.value)}
            placeholder={pick(
              lang,
              "For example: discussed budget, confirmed the visit, sent two estimate options.",
              "Например: обсудили бюджет, подтвердили выезд, отправили два варианта расчёта."
            )}
            rows={4}
            value={note}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Next step", "Следующий шаг")}</span>
          <input
            onChange={(event) => setNextAction(event.target.value)}
            placeholder={pick(
              lang,
              "For example: confirm address, send estimate, discuss deposit.",
              "Например: подтвердить адрес, отправить расчёт, обсудить предоплату."
            )}
            type="text"
            value={nextAction}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Follow up at", "Когда вернуться к клиенту")}</span>
          <input
            onChange={(event) => setFollowupAt(event.target.value)}
            type="datetime-local"
            value={followupAt}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save result", "Сохранить итог")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
