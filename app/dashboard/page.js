import TrackedLink from "../../components/tracked-link";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getAICRMSummary, getBOSEDashboardData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";
import { getOwnerAccessState } from "../../lib/owner-access-server";

export const metadata = {
  title: "Dashboard | BOSE"
};

const METRIC_COPY = {
  users: {
    ru: { label: "Пользователи", note: "Люди, сохранённые в BOSE." }
  },
  "active-users": {
    ru: { label: "Активные", note: "Люди, которые были активны за последние 14 дней." }
  },
  sessions: {
    ru: { label: "Сессии", note: "Сессии Mini App для аналитики и удержания." }
  },
  "new-users": {
    ru: { label: "Новые", note: "Новые пользователи за последние сутки." }
  },
  clients: {
    ru: { label: "Клиенты", note: "Клиенты, уже доступные в BOSE." }
  },
  deals: {
    ru: { label: "Сделки", note: "Сделки, которые сейчас двигаются внутри BOSE." }
  },
  tasks: {
    ru: { label: "Задачи", note: "Открытые задачи команды." }
  },
  followups: {
    ru: { label: "Следующие контакты", note: "Контакты, которые требуют следующего касания." }
  }
};

const DEAL_STAGE_LABELS = {
  new: { en: "new", ru: "новая" },
  contacted: { en: "contacted", ru: "контакт" },
  qualified: { en: "qualified", ru: "квалификация" },
  appointment: { en: "appointment", ru: "встреча" },
  proposal: { en: "proposal", ru: "предложение" },
  won: { en: "won", ru: "успех" },
  lost: { en: "lost", ru: "потеря" }
};

const CLIENT_STATUS_LABELS = {
  prospect: { en: "PROSPECT", ru: "лид" },
  active: { en: "ACTIVE", ru: "активен" },
  dormant: { en: "DORMANT", ru: "пауза" },
  archived: { en: "ARCHIVED", ru: "архив" }
};

function localizeMetric(item, lang) {
  if (lang !== "ru") {
    return item;
  }

  const copy = METRIC_COPY[item.key]?.ru;

  if (!copy) {
    return item;
  }

  return {
    ...item,
    label: copy.label,
    note: copy.note
  };
}

function localizeDealStage(stage, lang) {
  const normalized = String(stage || "").toLowerCase();
  const value = DEAL_STAGE_LABELS[normalized];
  return value ? value[lang === "ru" ? "ru" : "en"] : stage;
}

function localizeClientStatus(status, lang) {
  const normalized = String(status || "").toLowerCase();
  const value = CLIENT_STATUS_LABELS[normalized];
  return value ? value[lang === "ru" ? "ru" : "en"] : status;
}

function getAiModeNote(result, lang) {
  if (result?.mode === "ai") {
    return lang === "ru" ? "AI сейчас работает в live-режиме." : "AI is currently running in live mode.";
  }

  return lang === "ru"
    ? "AI сейчас недоступен, поэтому BOSE показывает безопасные локальные подсказки."
    : "AI is not configured right now, so BOSE is showing safe local guidance.";
}

function getDigestView(aiSummary, lang) {
  if (lang !== "ru" || aiSummary?.mode === "ai") {
    return {
      dailyDigest: aiSummary.data?.dailyDigest || "Digest is not available yet",
      overdueTasks: aiSummary.data?.overdueTasks || "No critical overdue work",
      workloadSummary:
        aiSummary.data?.workloadSummary || "The workload summary will appear here as the product gets used.",
      recommendations: aiSummary.data?.managerRecommendations || []
    };
  }

  return {
    dailyDigest: "BOSE следит за клиентами, сделками, задачами и следующими контактами в одном контуре.",
    overdueTasks: "Критичных просрочек сейчас нет или они ещё не накопились в живых данных.",
    workloadSummary: "Рабочая нагрузка появится здесь по мере использования продукта.",
    recommendations: ["Открой текущие сделки и проверь, что ни один клиент не завис без следующего шага."]
  };
}

function MetricCard({ item }) {
  return (
    <article className="focus-card">
      <span className="eyebrow">{item.label}</span>
      <strong>{item.value}</strong>
      <p>{item.note}</p>
    </article>
  );
}

function QueueEntry({ title, meta, href, eventLabel }) {
  const card = (
    <article className="work-item">
      <div>
        <strong>{title}</strong>
        <p>{meta}</p>
      </div>
    </article>
  );

  if (!href) {
    return card;
  }

  return (
    <TrackedLink className="queue-item-link-card" eventLabel={eventLabel || title} eventSource="dashboard" href={href}>
      {card}
    </TrackedLink>
  );
}

export default async function DashboardPage() {
  const [lang, ownerAccess, dashboard, aiSummary] = await Promise.all([
    getLanguage(),
    getOwnerAccessState(),
    getBOSEDashboardData(),
    getAICRMSummary()
  ]);
  const isRu = lang === "ru";
  const metrics = dashboard.metrics.map((item) => localizeMetric(item, lang));
  const stageBreakdown = Object.entries(dashboard.stageBreakdown || {});
  const digestView = getDigestView(aiSummary, lang);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE</p>
        <h1>{isRu ? "Рабочая панель" : "Workspace dashboard"}</h1>
        <p>
          {isRu
            ? "Главный экран для клиентов, сделок, задач, AI и текущего состояния BOSE."
            : "The main surface for clients, deals, tasks, AI, and the current state of the workspace."}
        </p>
      </section>

      {ownerAccess.isOwner ? (
        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Владелец" : "Owner"}</p>
            <h2>{isRu ? "Внутренние инструменты" : "Internal tools"}</h2>
          </div>
          <div className="quick-link-row">
            <TrackedLink className="ghost-link" eventLabel="Owner Mode" eventSource="dashboard-owner" href="/owner">
              {isRu ? "Режим владельца" : "Owner Mode"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="System Check" eventSource="dashboard-owner" href="/test">
              {isRu ? "Системная проверка" : "System Check"}
            </TrackedLink>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Куда нажать дальше" : "Where to click next"}</h2>
        </div>
        <WorkspaceShortcuts
          lang={lang}
          eventSource="dashboard-shortcuts"
          items={["clients", "deals", "tasks", "ai", "demo", "bot", "pricing"]}
        />
      </section>

      <section className="panel">
        <div className="focus-grid">
          {metrics.map((item) => (
            <MetricCard item={item} key={item.key} />
          ))}
        </div>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Стадии" : "Stages"}</p>
            <h2>{isRu ? "Воронка сделок" : "Deal pipeline"}</h2>
          </div>
          <div className="workboard-stack">
            {stageBreakdown.length ? (
              stageBreakdown.map(([stage, total]) => (
                <QueueEntry key={stage} title={localizeDealStage(stage, lang)} meta={isRu ? `${total} сделок` : `${total} deal(s)`} />
              ))
            ) : (
              <QueueEntry
                title={isRu ? "Данных по стадиям пока нет" : "No stage data yet"}
                meta={
                  isRu
                    ? "Сделки появятся здесь, как только BOSE начнёт двигаться вживую."
                    : "Deals will appear here as soon as the workspace starts moving."
                }
              />
            )}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI CRM Assistant</p>
            <h2>{isRu ? "Операционная сводка" : "Daily digest"}</h2>
          </div>
          <div className="workboard-stack">
            <QueueEntry title={digestView.dailyDigest} meta={getAiModeNote(aiSummary, lang)} />
            <QueueEntry title={digestView.overdueTasks} meta={digestView.workloadSummary} />
            {digestView.recommendations.map((item) => (
              <QueueEntry key={item} title={item} meta={isRu ? "Рекомендация BOSE" : "BOSE recommendation"} />
            ))}
            <TrackedLink className="ghost-link" eventLabel="Open AI" eventSource="dashboard" href="/ai">
              {isRu ? "Открыть AI" : "Open AI"}
            </TrackedLink>
          </div>
        </article>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Клиенты" : "Clients"}</p>
            <h2>{isRu ? "Последние записи" : "Recent records"}</h2>
          </div>
          <div className="workboard-stack">
            {dashboard.queues.clients.length ? (
              dashboard.queues.clients.map((item) => (
                <QueueEntry
                  key={item.id}
                  title={item.displayName}
                  meta={`${localizeClientStatus(item.status, lang)} - ${item.primaryPhone || (isRu ? "Телефон не указан" : "No phone")}`}
                  href={`/clients/${item.id}`}
                  eventLabel={`client:${item.displayName}`}
                />
              ))
            ) : (
              <QueueEntry
                title={isRu ? "Клиентов пока нет" : "No clients yet"}
                meta={
                  isRu
                    ? "Открой демо-режим или создай первую заявку через Telegram."
                    : "Open Demo Mode or create the first request through Telegram."
                }
              />
            )}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Сделки" : "Deals"}</p>
            <h2>{isRu ? "Последние записи" : "Recent records"}</h2>
          </div>
          <div className="workboard-stack">
            {dashboard.queues.deals.length ? (
              dashboard.queues.deals.map((item) => (
                <QueueEntry
                  key={item.id}
                  title={item.title}
                  meta={`${localizeDealStage(item.stageKey, lang)} - ${item.client?.displayName || (isRu ? "Клиент не указан" : "No client")}`}
                  href={`/deals/${item.id}`}
                  eventLabel={`deal:${item.title}`}
                />
              ))
            ) : (
              <QueueEntry
                title={isRu ? "Сделок пока нет" : "No deals yet"}
                meta={
                  isRu
                    ? "Открой демо-режим или создай первую заявку через Telegram."
                    : "Open Demo Mode or create the first request through Telegram."
                }
              />
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
