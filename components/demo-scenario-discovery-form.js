"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  getScenarioDraftCategoryLabel,
  listScenarioDraftCategories,
  normalizeScenarioDraftCategory
} from "../lib/scenario-drafts";
import {
  readMiniAppSessionSnapshot,
  trackMiniAppEvent
} from "./miniapp-launch-client";

function buildLabels(lang) {
  const isRu = lang === "ru";

  return {
    eyebrow: isRu ? "Discovery" : "Discovery",
    title: isRu ? "Что вы хотите автоматизировать?" : "What do you want to automate?",
    subtitle: isRu
      ? "Опишите, какую часть работы вы хотите передать BOSE. Мы соберем сценарий и покажем, как бот может помочь."
      : "Describe which part of the work you want BOSE to take over. We will draft the scenario and show how the bot can help.",
    categoryLabel: isRu ? "Выберите область" : "Choose an area",
    descriptionLabel: isRu ? "Опишите, как это работает сейчас" : "Describe how it works now",
    descriptionPlaceholder: isRu
      ? "Например: клиент пишет в Telegram, менеджер отвечает, если клиент молчит 2 дня — нужно напомнить."
      : "For example: a client writes in Telegram, a manager replies, and if the client stays silent for two days, BOSE should remind them.",
    submit: isRu ? "Собрать сценарий" : "Build scenario",
    submitting: isRu ? "Собираем..." : "Building...",
    missingCategory: isRu ? "Сначала выберите область." : "Choose a category first.",
    missingText: isRu ? "Опишите процесс своими словами." : "Describe the process in your own words.",
    successTitle: isRu ? "Готово. BOSE собрал черновик сценария." : "Done. BOSE drafted the scenario.",
    understood: isRu ? "BOSE понял" : "BOSE understood",
    firstStep: isRu ? "Первый автоматизируемый шаг" : "First step to automate",
    next: isRu ? "Что будет дальше" : "What happens next",
    nextText: isRu
      ? "Мы сохранили этот запрос как продуктовый сигнал и внутреннюю задачу для просмотра владельцем BOSE."
      : "We saved this request as a product signal and an internal review task for the BOSE owner.",
    errorFallback: isRu
      ? "Не удалось собрать сценарий. Попробуйте еще раз."
      : "BOSE could not build the scenario draft. Please try again.",
    duplicate: isRu
      ? "Такой запрос уже есть в BOSE. Мы покажем текущий черновик."
      : "This request is already stored in BOSE. Showing the current draft."
  };
}

export default function DemoScenarioDiscoveryForm({ lang = "en" }) {
  const labels = useMemo(() => buildLabels(lang), [lang]);
  const categories = useMemo(
    () =>
      listScenarioDraftCategories().map((item) => ({
        id: item.id,
        label: getScenarioDraftCategoryLabel(item.id, lang)
      })),
    [lang]
  );
  const [category, setCategory] = useState("");
  const [rawText, setRawText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;
    void trackMiniAppEvent("demo_scenario_started", {
      source: "demo_page"
    });
  }, []);

  const handleCategorySelect = (nextCategory) => {
    const normalized = normalizeScenarioDraftCategory(nextCategory);
    setCategory(normalized);

    void trackMiniAppEvent("demo_category_selected", {
      source: "demo_page",
      category: normalized
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!category) {
      setFeedback({
        ok: false,
        message: labels.missingCategory
      });
      return;
    }

    if (!rawText.trim()) {
      setFeedback({
        ok: false,
        message: labels.missingText
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    const session = readMiniAppSessionSnapshot();

    try {
      const response = await fetch("/api/scenario-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          source: "demo_page",
          category,
          rawText,
          sessionId: session?.sessionId || null,
          profileId: session?.profileId || null,
          subjectType: session?.subjectType || null,
          subjectId: session?.subjectId || null,
          userId: session?.userId || null,
          clientId: session?.clientId || null,
          telegramUserId: session?.telegramUserId || null,
          chatId: session?.chatId || null,
          username: session?.username || null,
          languageCode: session?.languageCode || null,
          platform: session?.platform || "telegram-miniapp",
          appVersion: session?.appVersion || "rc1"
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
        created: Boolean(data.created),
        draft: data.draft,
        message: data.created ? labels.successTitle : labels.duplicate
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
        <h2>{labels.title}</h2>
        <p>{labels.subtitle}</p>
      </div>

      <form className="demo-discovery-form" onSubmit={handleSubmit}>
        <div className="demo-discovery-group">
          <label className="demo-discovery-label">{labels.categoryLabel}</label>
          <div className="demo-category-grid">
            {categories.map((item) => (
              <button
                className={item.id === category ? "demo-category-pill demo-category-pill-active" : "demo-category-pill"}
                key={item.id}
                onClick={() => handleCategorySelect(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="demo-discovery-group">
          <label className="demo-discovery-label" htmlFor="demo-scenario-raw-text">
            {labels.descriptionLabel}
          </label>
          <textarea
            className="scenario-textarea"
            id="demo-scenario-raw-text"
            onChange={(event) => setRawText(event.target.value)}
            placeholder={labels.descriptionPlaceholder}
            rows={6}
            value={rawText}
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
              <p className="eyebrow">{feedback.created ? "Draft" : "Existing draft"}</p>
              <h3>{feedback.message}</h3>
              <p>
                <strong>{labels.understood}:</strong> {feedback.draft.aiSummary || feedback.draft.rawText}
              </p>
              <p>
                <strong>{labels.firstStep}:</strong> {feedback.draft.suggestedTrigger || "-"}
              </p>
              <p>
                <strong>{labels.next}:</strong> {labels.nextText}
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
