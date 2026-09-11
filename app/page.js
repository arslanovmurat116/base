import { getOwnerAccessState } from '../lib/owner-access-server';
import TrackedLink from "../components/tracked-link";
import { getBOSEDashboardData } from "../lib/server-data";
import { getLanguage } from "../lib/i18n-server";

const TELEGRAM_BOT_BASE_HREF = "https://t.me/bose_business_os_bot";

const METRIC_COPY = {
  users: {
    ru: { label: "Пользователи", note: "Люди, которых BOSE уже сохранил через Telegram и Mini App." }
  },
  "active-users": {
    ru: { label: "Активные", note: "Пользователи, которые были в системе за последние 14 дней." }
  },
  sessions: {
    ru: { label: "Сессии", note: "Сессии Mini App для аналитики и удержания." }
  },
  "new-users": {
    ru: { label: "Новые", note: "Новые пользователи за последние сутки." }
  },
  clients: {
    ru: { label: "Клиенты", note: "Клиентские записи, уже доступные в BOSE." }
  },
  deals: {
    ru: { label: "Сделки", note: "Сделки, которые уже двигаются внутри BOSE." }
  },
  tasks: {
    ru: { label: "Задачи", note: "Открытые задачи команды." }
  },
  followups: {
    ru: { label: "Следующие контакты", note: "Контакты, которые нельзя потерять." }
  }
};

function MetricCard({ label, value, note }) {
  return (
    <article className="focus-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

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

export default async function HomePage() {
  const lang = await getLanguage();
  const { session } = await getOwnerAccessState();
  const dashboard = ['owner','manager'].includes(session?.role) ? await getBOSEDashboardData() : {metrics:[]};
  const isRu = lang === "ru";
  const metrics = dashboard.metrics.slice(0, 6).map((item) => localizeMetric(item, lang));

  return (
    <main className="page-shell landing-shell">
      <section className="hero-panel product-hero">
        <div className="hero-copy">
          <p className="eyebrow">BOSE</p>
          <h1>{isRu ? "Бизнес работает внутри Telegram." : "Run the workspace inside Telegram."}</h1>
          <p className="hero-text">
            {isRu
              ? "BOSE объединяет клиентов, сделки, задачи, аналитику и AI в одном Mini App. Новый пользователь должен понять это без инструкций и без лишних экранов."
              : "BOSE brings clients, deals, tasks, analytics, and AI into one Mini App. A new user should understand it without instructions or extra screens."}
          </p>

          <div className="quick-link-row">
            <TrackedLink className="primary-link" eventLabel="Open Workspace" eventSource="home" href="/dashboard">
              {isRu ? "Открыть BOSE" : "Open Workspace"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Demo Mode" eventSource="home" href="/demo">
              {isRu ? "Демо-режим" : "Demo Mode"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="AI Assistant" eventSource="home" href="/ai">
              {isRu ? "AI-ассистент" : "AI Assistant"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Clients" eventSource="home" href="/clients">
              {isRu ? "Клиенты" : "Clients"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Deals" eventSource="home" href="/deals">
              {isRu ? "Сделки" : "Deals"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Tasks" eventSource="home" href="/tasks">
              {isRu ? "Задачи" : "Tasks"}
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Старт" : "Onboarding"}</p>
          <h2>{isRu ? "Как начать за минуту" : "How to start in one minute"}</h2>
        </div>
        <div className="workboard-grid">
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Что такое BOSE" : "What BOSE is"}</h3>
            <p>
              {isRu
                ? "Это рабочее пространство внутри Telegram для клиентов, сделок, задач, событий и AI."
                : "It is a Telegram-first workspace for clients, deals, tasks, events, and AI."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Как начать" : "How to begin"}</h3>
            <p>
              {isRu
                ? "Открой демо-режим, запусти бота или сразу переходи в основную панель."
                : "Open Demo Mode, launch the bot, or jump directly into the workspace."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Зачем Telegram" : "Why Telegram"}</h3>
            <p>
              {isRu
                ? "Telegram даёт вход, возврат, быстрые ссылки, уведомления и саму оболочку Mini App."
                : "Telegram gives BOSE the entrypoint, the return path, deep links, notifications, and the Mini App shell."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Что делает AI" : "What AI does"}</h3>
            <p>
              {isRu
                ? "AI помогает со сводкой, следующим шагом, черновиком ответа и операционной сводкой."
                : "AI helps with summary, next action, draft reply, and the operating digest."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Панель" : "Workspace"}</p>
          <h2>{isRu ? "Живой срез BOSE" : "Live BOSE snapshot"}</h2>
        </div>
        <div className="focus-grid">
          {metrics.map((item) => (
            <MetricCard key={item.key} label={item.label} value={item.value} note={item.note} />
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Подписки" : "Plans"}</p>
          <h2>{isRu ? "Подписки и доступ" : "Subscriptions and access"}</h2>
        </div>
        <div className="plan-grid">
          <article className="panel plan-card">
            <p className="eyebrow">Free</p>
            <h3>{isRu ? "Первый запуск" : "First launch"}</h3>
            <span className="plan-price">{isRu ? "Бесплатно" : "Free"}</span>
            <p className="plan-note">
              {isRu ? "Демо, бот и основные экраны BOSE." : "Demo mode, the bot, and the main BOSE surfaces."}
            </p>
          </article>
          <article className="panel plan-card plan-card-accent">
            <p className="eyebrow">Pro</p>
            <h3>{isRu ? "Рабочий режим" : "Operational mode"}</h3>
            <span className="plan-price">{isRu ? "Скоро" : "Soon"}</span>
            <p className="plan-note">
              {isRu ? "Клиенты, сделки, задачи, аналитика и AI в одном контуре." : "Clients, deals, tasks, analytics, and AI in one loop."}
            </p>
          </article>
          <article className="panel plan-card">
            <p className="eyebrow">Business</p>
            <h3>{isRu ? "Командный доступ" : "Team access"}</h3>
            <span className="plan-price">{isRu ? "Скоро" : "Soon"}</span>
            <p className="plan-note">
              {isRu
                ? "Режим владельца, удержание и расширенный доступ для команды."
                : "Owner mode, retention, and expanded access for the team."}
            </p>
          </article>
        </div>
        <div className="quick-link-row">
          <TrackedLink className="ghost-link" eventLabel="Pricing" eventSource="home" href="/pricing">
            {isRu ? "Открыть тарифы" : "Open pricing"}
          </TrackedLink>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">Telegram</p>
          <h2>{isRu ? "Быстрые входы" : "Quick links"}</h2>
        </div>
        <div className="quick-link-row">
          <TrackedLink
            className="ghost-link"
            eventLabel="Open Bot"
            eventSource="home"
            href={`${TELEGRAM_BOT_BASE_HREF}?start=demo`}
            rel="noreferrer"
            target="_blank"
          >
            {isRu ? "Открыть бота" : "Open Bot"}
          </TrackedLink>
          <TrackedLink
            className="ghost-link"
            eventLabel="Bot Request"
            eventSource="home"
            href={`${TELEGRAM_BOT_BASE_HREF}?start=request`}
            rel="noreferrer"
            target="_blank"
          >
            {isRu ? "Запустить заявку" : "Start client request"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Privacy" eventSource="home" href="/privacy">
            {isRu ? "Политика" : "Privacy Policy"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Terms" eventSource="home" href="/terms">
            {isRu ? "Условия" : "Terms of Use"}
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
