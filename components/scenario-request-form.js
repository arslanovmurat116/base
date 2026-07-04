"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getScenarioDraftCategoryLabel,
  getScenarioTargetPlatformLabel,
  listScenarioOrderCategories,
  listScenarioTargetPlatforms
} from "../lib/scenario-drafts";
import {
  readMiniAppSessionSnapshot,
  trackMiniAppEvent
} from "./miniapp-launch-client";

function buildLabels(lang) {
  const isRu = lang === "ru";

  return {
    eyebrow: isRu ? "Сценарий" : "Scenario",
    titleLabel: isRu ? "Название" : "Title",
    descriptionLabel: isRu ? "Описание задачи" : "Task description",
    categoryLabel: isRu ? "Категория" : "Category",
    platformLabel: isRu ? "Целевая платформа" : "Target platform",
    constraintsLabel: isRu ? "Ограничения и пожелания" : "Constraints and preferences",
    titlePlaceholder: isRu ? "Например: Обработка заявки клиента" : "For example: Client lead intake",
    descriptionPlaceholder: isRu
      ? "Опишите, что должно происходить: где приходит заявка, что нужно сохранить, кого уведомить."
      : "Describe what should happen: where the request arrives, what must be saved, and who should be notified.",
    constraintsPlaceholder: isRu
      ? "Например: без секретов, только Telegram, без реальных платежей"
      : "For example: no secrets, Telegram only, no real payments",
    submit: isRu ? "Отправить заявку" : "Submit request",
    submitting: isRu ? "Отправляем..." : "Submitting...",
    sessionError: isRu
      ? "Откройте форму внутри Telegram Mini App, чтобы BOSE получил проверенную сессию."
      : "Open this form inside the Telegram Mini App so BOSE can use a verified session.",
    successTitle: isRu ? "Заявка принята" : "Request accepted",
    nextLabel: isRu ? "Следующий этап" : "Next stage",
    nextText: isRu
      ? "Владелец BOSE увидит заявку, сможет изменить статус и экспортировать JSON для WorkHub."
      : "The BOSE owner will review the request, update the status, and export JSON for WorkHub.",
    errorFallback: isRu ? "Не удалось сохранить заявку." : "Could not save the request.",
    missingTitle: isRu ? "Укажите название." : "Title is required.",
    missingDescription: isRu ? "Опишите задачу." : "Description is required."
  };
}

function splitConstraints(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ScenarioRequestForm({ lang = "en" }) {
  const labels = useMemo(() => buildLabels(lang), [lang]);
  const categories = useMemo(
    () =>
      listScenarioOrderCategories().map((item) => ({
        id: item.id,
        label: getScenarioDraftCategoryLabel(item.id, lang)
      })),
    [lang]
  );
  const platforms = useMemo(
    () =>
      listScenarioTargetPlatforms().map((item) => ({
        id: item.id,
        label: getScenarioTargetPlatformLabel(item.id, lang)
      })),
    [lang]
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("crm");
  const [targetPlatform, setTargetPlatform] = useState("telegram");
  const [constraints, setConstraints] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    void trackMiniAppEvent("button_click", {
      label: "Scenario request page opened",
      source: "scenario-request-page"
    });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!title.trim()) {
      setFeedback({
        ok: false,
        message: labels.missingTitle
      });
      return;
    }

    if (!description.trim()) {
      setFeedback({
        ok: false,
        message: labels.missingDescription
      });
      return;
    }

    const session = readMiniAppSessionSnapshot();

    if (!session?.sessionId || !session?.sessionToken) {
      setFeedback({
        ok: false,
        message: labels.sessionError
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/scenario-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          category,
          targetPlatform,
          constraints: splitConstraints(constraints),
          sessionId: session.sessionId,
          sessionToken: session.sessionToken
        })
      });
      const data = await response.json();

      if (!response.ok || !data?.ok || !data?.draft) {
        setFeedback({
          ok: false,
          message: data?.message || labels.errorFallback
        });
        return;
      }

      setFeedback({
        ok: true,
        draft: data.draft,
        nextStep: data.nextStep || labels.nextText
      });
      setTitle("");
      setDescription("");
      setConstraints("");
      await trackMiniAppEvent("button_click", {
        label: "Scenario request submitted",
        source: "scenario-request-page",
        draftId: data.draft.id,
        category: data.draft.category,
        targetPlatform: data.draft.targetPlatform
      });
    } catch {
      setFeedback({
        ok: false,
        message: labels.errorFallback
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel demo-discovery-panel">
      <div className="section-title">
        <p className="eyebrow">{labels.eyebrow}</p>
        <h2>{lang === "ru" ? "Заказ сценария для BOSE" : "Order a BOSE scenario"}</h2>
        <p>
          {lang === "ru"
            ? "Опишите, какой сценарий вы хотите внедрить. BOSE сохранит заявку, покажет её владельцу и подготовит экспорт для WorkHub."
            : "Describe the scenario you want to implement. BOSE will save the request, show it to the owner, and prepare the export for WorkHub."}
        </p>
      </div>

      <form className="demo-discovery-form" onSubmit={handleSubmit}>
        <div className="demo-discovery-group">
          <label className="demo-discovery-label" htmlFor="scenario-request-title">
            {labels.titleLabel}
          </label>
          <input
            className="scenario-textarea"
            id="scenario-request-title"
            maxLength={140}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={labels.titlePlaceholder}
            type="text"
            value={title}
          />
        </div>

        <div className="demo-discovery-group">
          <label className="demo-discovery-label" htmlFor="scenario-request-description">
            {labels.descriptionLabel}
          </label>
          <textarea
            className="scenario-textarea"
            id="scenario-request-description"
            maxLength={4000}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={labels.descriptionPlaceholder}
            rows={7}
            value={description}
          />
        </div>

        <div className="demo-discovery-group">
          <label className="demo-discovery-label">{labels.categoryLabel}</label>
          <div className="demo-category-grid">
            {categories.map((item) => (
              <button
                className={item.id === category ? "demo-category-pill demo-category-pill-active" : "demo-category-pill"}
                key={item.id}
                onClick={() => setCategory(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-discovery-group">
          <label className="demo-discovery-label">{labels.platformLabel}</label>
          <div className="demo-category-grid">
            {platforms.map((item) => (
              <button
                className={item.id === targetPlatform ? "demo-category-pill demo-category-pill-active" : "demo-category-pill"}
                key={item.id}
                onClick={() => setTargetPlatform(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-discovery-group">
          <label className="demo-discovery-label" htmlFor="scenario-request-constraints">
            {labels.constraintsLabel}
          </label>
          <textarea
            className="scenario-textarea"
            id="scenario-request-constraints"
            maxLength={2000}
            onChange={(event) => setConstraints(event.target.value)}
            placeholder={labels.constraintsPlaceholder}
            rows={4}
            value={constraints}
          />
        </div>

        <div className="quick-link-row">
          <button className="primary-link" disabled={submitting} type="submit">
            {submitting ? labels.submitting : labels.submit}
          </button>
        </div>
      </form>

      {feedback ? (
        <div className={feedback.ok ? "panel note-card demo-discovery-result" : "form-feedback"}>
          {feedback.ok ? (
            <>
              <p className="eyebrow">{labels.successTitle}</p>
              <h3>{feedback.draft.title}</h3>
              <p>
                <strong>ID:</strong> {feedback.draft.id}
              </p>
              <p>
                <strong>Status:</strong> {feedback.draft.status}
              </p>
              <p>
                <strong>{labels.nextLabel}:</strong> {feedback.nextStep}
              </p>
            </>
          ) : (
            <p>{feedback.message}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
