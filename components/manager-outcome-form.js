"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const OUTCOMES = [
  {
    value: "replied",
    label: "Взяли в работу",
    status: "CONTACTED",
    hint: "Менеджер уже вышел на связь и двигает клиента дальше по сделке."
  },
  {
    value: "awaiting_response",
    label: "Ждём ответ",
    status: "CONTACTED",
    hint: "Контакт был, но теперь нужен возврат или аккуратное ожидание ответа от клиента."
  },
  {
    value: "qualified",
    label: "Бриф собран",
    status: "QUALIFIED",
    hint: "Запрос понятен, клиент целевой, можно переходить к расчёту или подготовке КП."
  },
  {
    value: "meeting_booked",
    label: "Назначили замер",
    status: "MEETING",
    hint: "Замер, шоурум или консультация уже зафиксированы в системе."
  },
  {
    value: "proposal_sent",
    label: "Отправили расчёт / КП",
    status: "PROPOSAL",
    hint: "Клиент уже получил цифры и теперь сделка живёт в дожиме."
  },
  {
    value: "won",
    label: "Закрыли сделку",
    status: "WON",
    hint: "Клиент подтвердил условия и сделка дошла до денег."
  },
  {
    value: "lost",
    label: "Потеряли сделку",
    status: "LOST",
    hint: "Важно зафиксировать честную причину потери, чтобы потом не гадать."
  }
];

const TRACK_PRESETS = {
  booking: [
    {
      label: "Готов к замеру",
      outcome: "meeting_booked",
      note: "Клиент согласовал выезд, нужно закрепить слот и не потерять подтверждение адреса.",
      nextAction: "Подтвердить адрес, время и кто будет на объекте"
    },
    {
      label: "Нужен другой слот",
      outcome: "awaiting_response",
      note: "Интерес есть, но текущее время замера не подходит.",
      nextAction: "Предложить 2–3 альтернативных окна для выезда"
    },
    {
      label: "Ждём подтверждение",
      outcome: "awaiting_response",
      note: "Клиент ещё не закрепил выезд, нужен мягкий follow-up.",
      nextAction: "Напомнить про замер и получить подтверждение адреса"
    }
  ],
  estimate: [
    {
      label: "Нужен расчёт",
      outcome: "qualified",
      note: "Вводные собраны, следующий шаг — смета или диапазон цены.",
      nextAction: "Подготовить расчёт и отправить в обещанный срок"
    },
    {
      label: "КП отправлено",
      outcome: "proposal_sent",
      note: "Клиент уже получил расчёт и теперь важно не потерять темп.",
      nextAction: "Вернуться к клиенту после отправки КП и пройтись по вопросам"
    },
    {
      label: "Уточняем бюджет",
      outcome: "awaiting_response",
      note: "Есть интерес, но бюджетный диапазон пока не подтверждён.",
      nextAction: "Понять комфортный чек и скорректировать вариант решения"
    }
  ],
  consultation: [
    {
      label: "Готов на созвон",
      outcome: "meeting_booked",
      note: "Клиент готов к короткой консультации перед расчётом или замером.",
      nextAction: "Назначить консультацию и отправить рамку разговора"
    },
    {
      label: "Нужны примеры",
      outcome: "replied",
      note: "Перед созвоном клиент хочет увидеть кейсы, материалы или варианты фасадов.",
      nextAction: "Отправить примеры работ и вернуться с предложением созвона"
    },
    {
      label: "Вернуться позже",
      outcome: "awaiting_response",
      note: "Интерес есть, но сейчас клиент не готов двигаться дальше по времени.",
      nextAction: "Поставить повторный контакт и вернуться в согласованный день"
    }
  ],
  explore: [
    {
      label: "Изучает варианты",
      outcome: "replied",
      note: "Клиент пока смотрит и сравнивает решения, без жёсткого дедлайна.",
      nextAction: "Отправить короткую рамку решения и кейсы похожих проектов"
    },
    {
      label: "Есть шанс прогреть",
      outcome: "awaiting_response",
      note: "Можно мягко вернуться после того, как клиент посмотрит примеры.",
      nextAction: "Поставить follow-up на 2–3 дня и вернуться по кейсам"
    }
  ]
};

function formatStatusLabel(status) {
  switch (status) {
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

export default function ManagerOutcomeForm({ slug, initialStatus, requestTrack }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState("awaiting_response");
  const [status, setStatus] = useState(initialStatus || "CONTACTED");
  const [note, setNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [followupAt, setFollowupAt] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const matched = OUTCOMES.find((item) => item.value === outcome);

    if (matched?.status) {
      setStatus(matched.status);
    }
  }, [outcome]);

  const presets = TRACK_PRESETS[requestTrack] || [];

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

      const result = await response.json();
      setFeedback(result.message || "Результат сохранён");

      if (response.ok) {
        setNote("");
        setNextAction("");
        setFollowupAt("");
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка формы: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  const activeOutcome =
    OUTCOMES.find((item) => item.value === outcome) || OUTCOMES[0];

  return (
    <section className="panel workflow-form-panel outcome-form-panel">
      <div className="section-title">
        <p className="eyebrow">Контакт</p>
        <h2>Зафиксировать исход общения с клиентом</h2>
        <p>
          Это быстрый менеджерский блок: что случилось после звонка или
          переписки, на каком этапе теперь сделка и нужен ли возврат по расчёту,
          замеру, согласованию или предоплате.
        </p>
        {presets.length ? (
          <p className="outcome-track-hint">
            Для текущего типа запроса система подсказывает самые логичные
            сценарии, чтобы менеджер не придумывал следующий шаг с нуля.
          </p>
        ) : null}
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
          {OUTCOMES.map((item) => (
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
            <span>Итог контакта</span>
            <select value={outcome} onChange={(event) => setOutcome(event.target.value)}>
              {OUTCOMES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Новый статус</span>
            <input disabled type="text" value={formatStatusLabel(status)} />
          </label>
        </div>

        <label className="field-block">
          <span>Что сделал менеджер</span>
          <textarea
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например: обсудили бюджет, подтвердили замер, отправили два варианта расчёта"
            rows={4}
            value={note}
          />
        </label>

        <label className="field-block">
          <span>Следующий шаг</span>
          <input
            onChange={(event) => setNextAction(event.target.value)}
            placeholder="Например: подтвердить адрес замера, выдать расчёт, обсудить предоплату"
            type="text"
            value={nextAction}
          />
        </label>

        <label className="field-block">
          <span>Когда вернуться к клиенту</span>
          <input
            onChange={(event) => setFollowupAt(event.target.value)}
            type="datetime-local"
            value={followupAt}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Сохраняем..." : "Сохранить исход"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
