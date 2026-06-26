import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import EventBeacon from "../../components/event-beacon";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getAICRMSummary, getLeadAISalesAssistantData, getLeadsData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "AI | BOSE"
};

function getAiAvailabilityMessage(result, lang) {
  if (result?.mode === "ai") {
    return lang === "ru" ? "BOSE AI сейчас работает в live-режиме." : "BOSE AI is currently running in live mode.";
  }

  return lang === "ru"
    ? "BOSE AI временно работает в безопасном локальном режиме и даёт понятные подсказки без ошибки."
    : "BOSE AI is currently in safe local mode and will keep giving clean guidance instead of an error.";
}

function localizeDealStage(status, lang) {
  const map = {
    new: { en: "new", ru: "новая" },
    contacted: { en: "contacted", ru: "контакт" },
    qualified: { en: "qualified", ru: "квалификация" },
    appointment: { en: "appointment", ru: "встреча" },
    proposal: { en: "proposal", ru: "предложение" },
    won: { en: "won", ru: "успех" },
    lost: { en: "lost", ru: "потеря" }
  };
  const entry = map[String(status || "").toLowerCase()];
  return entry ? entry[lang === "ru" ? "ru" : "en"] : status;
}

function getSalesAssistantView({ salesSummary, sampleLead, lang }) {
  const isRu = lang === "ru";

  if (!isRu || salesSummary?.mode === "ai") {
    return {
      summary: salesSummary?.data?.summary,
      nextAction: salesSummary?.data?.nextAction,
      replyDraft: salesSummary?.data?.replyDraft
    };
  }

  return {
    summary: `${sampleLead?.name || "Клиент"} сейчас на стадии ${localizeDealStage(sampleLead?.status || "NEW", lang)}. BOSE готов показать следующий шаг и безопасный черновик ответа.`,
    nextAction: sampleLead?.nextAction || "Связаться с клиентом и уточнить детали запроса.",
    replyDraft:
      "Здравствуйте. Увидели ваш запрос и взяли его в работу. Могу быстро уточнить детали и предложить удобное окно для связи."
  };
}

function getCrmAssistantView({ crmSummary, lang }) {
  const isRu = lang === "ru";

  if (!isRu || crmSummary?.mode === "ai") {
    return {
      dailyDigest: crmSummary.data?.dailyDigest,
      overdueTasks: crmSummary.data?.overdueTasks,
      workloadSummary: crmSummary.data?.workloadSummary,
      recommendations: crmSummary.data?.managerRecommendations || []
    };
  }

  return {
    dailyDigest: "BOSE собрал безопасную локальную сводку по клиентам, сделкам, задачам и следующему касанию.",
    overdueTasks: "Критичных просрочек сейчас нет или они ещё не накопились в живых данных.",
    workloadSummary: "Как только живых данных станет больше, здесь появится полная AI-сводка по нагрузке команды.",
    recommendations: ["Проверь текущие сделки и не оставляй клиентов без следующего шага."]
  };
}

export default async function AIPage() {
  const lang = await getLanguage();
  const [crmSummary, leads] = await Promise.all([getAICRMSummary(), getLeadsData()]);
  const sampleLead = leads[0] || null;
  const salesSummary = sampleLead ? await getLeadAISalesAssistantData(sampleLead.slug) : null;
  const relatedDealId = sampleLead?.boseCore?.deal?.id || null;
  const isRu = lang === "ru";
  const salesView = getSalesAssistantView({ salesSummary, sampleLead, lang });
  const crmView = getCrmAssistantView({ crmSummary, lang });

  return (
    <main className="page-shell">
      <EventBeacon eventName="ai_used" eventPayload={{ surface: "ai-page", assistants: ["sales", "crm"] }} />
      <section className="page-heading">
        <p className="eyebrow">BOSE AI</p>
        <h1>{isRu ? "AI-ассистент" : "AI Assistant"}</h1>
        <p>
          {isRu
            ? "Единый AI-слой для сводок, следующих шагов, черновиков ответов и ежедневной сводки по BOSE."
            : "One AI layer for summaries, next actions, draft replies, and daily workspace guidance."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Куда идти после AI" : "Where to go after AI"}</h2>
        </div>
        <WorkspaceShortcuts
          lang={lang}
          eventSource="ai-shortcuts"
          items={["dashboard", "clients", "deals", "tasks", "bot", "request", "pricing"]}
        />
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI Sales Assistant</p>
            <h2>{isRu ? "По одной живой сделке" : "For one live deal"}</h2>
          </div>
          {salesSummary?.data ? (
            <div className="workboard-stack">
              <article className="work-item">
                <div>
                  <strong>{isRu ? "Сводка" : "Summary"}</strong>
                  <p>{salesView.summary}</p>
                </div>
              </article>
              <article className="work-item">
                <div>
                  <strong>{isRu ? "Следующий шаг" : "Next action"}</strong>
                  <p>{salesView.nextAction}</p>
                </div>
              </article>
              <article className="work-item">
                <div>
                  <strong>{isRu ? "Черновик ответа" : "Draft reply"}</strong>
                  <p>{salesView.replyDraft}</p>
                </div>
              </article>
              <article className="work-item">
                <div>
                  <strong>{isRu ? "Состояние AI" : "AI state"}</strong>
                  <p>{getAiAvailabilityMessage(salesSummary, lang)}</p>
                </div>
              </article>
              <TrackedLink
                className="ghost-link"
                eventLabel="AI Sales Assistant"
                eventSource="ai-page"
                href={relatedDealId ? `/deals/${relatedDealId}` : sampleLead?.slug ? `/leads/${sampleLead.slug}` : "/deals"}
              >
                {isRu ? "Открыть связанную сделку" : "Open related deal"}
              </TrackedLink>
            </div>
          ) : (
            <>
              <p>{isRu ? "Пока нет живой сделки для AI-примера." : "No live deal is available for an AI example yet."}</p>
              <EmptyStateActions lang={lang} />
            </>
          )}
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI CRM Assistant</p>
            <h2>{isRu ? "Операционная сводка" : "Operating digest"}</h2>
          </div>
          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{crmView.dailyDigest || (isRu ? "Сводка пока недоступна" : "Digest is not available yet")}</strong>
                <p>{getAiAvailabilityMessage(crmSummary, lang)}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{crmView.overdueTasks || (isRu ? "Нет просроченных задач" : "No overdue tasks")}</strong>
                <p>
                  {crmView.workloadSummary ||
                    (isRu
                      ? "BOSE покажет сводку по нагрузке по мере накопления живых данных."
                      : "BOSE will show the workload summary as live workspace data grows.")}
                </p>
              </div>
            </article>
            {crmView.recommendations.map((item) => (
              <article className="work-item" key={item}>
                <div>
                  <strong>{item}</strong>
                  <p>BOSE AI</p>
                </div>
              </article>
            ))}
            <TrackedLink className="ghost-link" eventLabel="Open Dashboard" eventSource="ai-page" href="/dashboard">
              {isRu ? "Открыть панель" : "Open dashboard"}
            </TrackedLink>
          </div>
        </article>
      </section>
    </main>
  );
}
