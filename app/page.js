import TrackedLink from "../components/tracked-link";
import { getBOSEDashboardData } from "../lib/server-data";
import { getLanguage } from "../lib/i18n-server";

const TELEGRAM_BOT_BASE_HREF = "https://t.me/bose_business_os_bot";

function MetricCard({ label, value, note }) {
  return (
    <article className="focus-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </article>
  );
}

export default async function HomePage() {
  const lang = await getLanguage();
  const dashboard = await getBOSEDashboardData();
  const isRu = lang === "ru";

  return (
    <main className="page-shell landing-shell">
      <section className="hero-panel product-hero">
        <div className="hero-copy">
          <p className="eyebrow">BOSE</p>
          <h1>{isRu ? "Рабочее пространство для бизнеса внутри Telegram." : "A business workspace that runs inside Telegram."}</h1>
          <p className="hero-text">
            {isRu
              ? "Открой BOSE, зайди в demo, посмотри клиентов, сделки, задачи и AI без лишних объяснений."
              : "Open BOSE, enter demo mode, review clients, deals, tasks, and AI, and understand the product without a long explanation."}
          </p>

          <div className="quick-link-row">
            <TrackedLink className="primary-link" eventLabel="Open Workspace" eventSource="home" href="/dashboard">
              Open Workspace
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Demo Mode" eventSource="home" href="/demo">
              Demo Mode
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="AI Assistant" eventSource="home" href="/ai">
              AI Assistant
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Clients" eventSource="home" href="/clients">
              Clients
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Deals" eventSource="home" href="/deals">
              Deals
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Tasks" eventSource="home" href="/tasks">
              Tasks
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">Onboarding</p>
          <h2>{isRu ? "Как начать за минуту" : "How to start in one minute"}</h2>
        </div>
        <div className="workboard-grid">
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Что такое BOSE" : "What BOSE is"}</h3>
            <p>
              {isRu
                ? "Это рабочее пространство внутри Telegram: клиенты, сделки, задачи, события и AI в одном Mini App."
                : "BOSE is a Telegram-first business OS: clients, deals, tasks, events, and AI in one Mini App."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Как начать" : "How to begin"}</h3>
            <p>
              {isRu
                ? "Открой Demo Mode, запусти бота или сразу заходи в рабочее пространство."
                : "Open Demo Mode, launch the bot, or jump directly into the workspace."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Зачем Telegram" : "Why Telegram"}</h3>
            <p>
              {isRu
                ? "Telegram даёт вход, возврат, уведомления, deep links и Mini App как главный интерфейс."
                : "Telegram gives BOSE the entrypoint, return path, notifications, deep links, and the Mini App shell."}
            </p>
          </article>
          <article className="panel demo-deal-card">
            <h3>{isRu ? "Что делает AI" : "What AI does"}</h3>
            <p>
              {isRu
                ? "AI даёт summary, next action, draft reply и ежедневную сводку по рабочему пространству."
                : "AI gives you summary, next action, draft reply, and a daily CRM digest."}
            </p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">Workspace</p>
          <h2>{isRu ? "Живой срез пространства" : "Live workspace snapshot"}</h2>
        </div>
        <div className="focus-grid">
          {dashboard.metrics.slice(0, 8).map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} note={item.note} />
          ))}
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
            Open Bot
          </TrackedLink>
          <TrackedLink
            className="ghost-link"
            eventLabel="Bot Request"
            eventSource="home"
            href={`${TELEGRAM_BOT_BASE_HREF}?start=request`}
            rel="noreferrer"
            target="_blank"
          >
            Start Client Request
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Privacy" eventSource="home" href="/privacy">
            Privacy Policy
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Terms" eventSource="home" href="/terms">
            Terms
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
