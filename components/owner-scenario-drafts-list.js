"use client";

import { useMemo, useState } from "react";
import {
  getScenarioDraftCategoryLabel,
  getScenarioDraftSourceLabel,
  getScenarioTargetPlatformLabel,
  listScenarioDraftStatuses
} from "../lib/scenario-drafts";

function formatDate(value, lang) {
  if (!value) {
    return lang === "ru" ? "Неизвестно" : "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function getStatusChoices() {
  return listScenarioDraftStatuses();
}

export default function OwnerScenarioDraftsList({ initialDrafts = [], lang = "en" }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState("");
  const isRu = lang === "ru";
  const statusChoices = useMemo(() => getStatusChoices(), []);

  const applyDraftUpdate = (nextDraft) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === nextDraft.id ? { ...draft, ...nextDraft } : draft))
    );
  };

  const handleStatusChange = async (draftId, status) => {
    setBusyId(draftId);
    setFeedback("");

    try {
      const response = await fetch("/api/scenario-drafts", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: draftId,
          status
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.draft) {
        setFeedback(data?.message || (isRu ? "Не удалось обновить статус." : "Could not update the status."));
        return false;
      }

      applyDraftUpdate(data.draft);
      return true;
    } catch {
      setFeedback(isRu ? "Не удалось обновить статус." : "Could not update the status.");
      return false;
    } finally {
      setBusyId("");
    }
  };

  const handleExport = async (draftId) => {
    const updated = await handleStatusChange(draftId, "EXPORTED");
    if (!updated) {
      return;
    }

    window.location.href = `/api/scenario-drafts?id=${encodeURIComponent(draftId)}&format=workhub`;
  };

  if (!drafts.length) {
    return (
      <article className="panel timeline-empty">
        <strong>{isRu ? "Пока пусто" : "Nothing yet"}</strong>
        <p>
          {isRu
            ? "Как только пользователь отправит заказ через /scenario или Mini App, он появится здесь."
            : "As soon as a user submits an order through /scenario or the Mini App, it will appear here."}
        </p>
      </article>
    );
  }

  return (
    <div className="workboard-stack">
      {feedback ? <div className="form-feedback"><p>{feedback}</p></div> : null}
      {drafts.map((draft) => (
        <details className="panel workboard-panel" key={draft.id}>
          <summary className="followup-card-head" style={{ cursor: "pointer", listStyle: "none" }}>
            <div>
              <p className="eyebrow">{formatDate(draft.createdAt, lang)}</p>
              <h2>{draft.title || draft.aiSummary || draft.rawText}</h2>
              <p>{draft.description || draft.rawText}</p>
            </div>
            <div className="chip-row">
              <span className="chip-soft">{getScenarioDraftCategoryLabel(draft.category, lang)}</span>
              <span className="chip-soft">{getScenarioTargetPlatformLabel(draft.targetPlatform, lang)}</span>
              <span className="chip-soft">{draft.status}</span>
            </div>
          </summary>

          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{isRu ? "Пользователь" : "User"}</strong>
                <p>{draft.telegramUsername || draft.telegramUserId || (isRu ? "Неизвестно" : "Unknown")}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Источник" : "Source"}</strong>
                <p>{getScenarioDraftSourceLabel(draft.source, lang)}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Описание" : "Description"}</strong>
                <p>{draft.description || draft.rawText}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Ограничения" : "Constraints"}</strong>
                <p>{draft.constraints?.length ? draft.constraints.join("; ") : "-"}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Следующий шаг BOSE" : "BOSE next step"}</strong>
                <p>{draft.suggestedTrigger || "-"}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Краткое понимание" : "BOSE understood"}</strong>
                <p>{draft.aiSummary || draft.rawText}</p>
              </div>
            </article>
          </div>

          <div className="quick-link-row">
            {statusChoices.map((status) => (
              <button
                className={status === draft.status ? "primary-link" : "ghost-link"}
                disabled={busyId === draft.id}
                key={status}
                onClick={() => handleStatusChange(draft.id, status)}
                type="button"
              >
                {status}
              </button>
            ))}
            <button className="ghost-link" disabled={busyId === draft.id} onClick={() => handleExport(draft.id)} type="button">
              {isRu ? "Export для WorkHub" : "Export for WorkHub"}
            </button>
          </div>
        </details>
      ))}
    </div>
  );
}
