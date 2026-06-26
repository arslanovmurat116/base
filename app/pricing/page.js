import TrackedLink from "../../components/tracked-link";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Pricing | BOSE"
};

function PlanCard({ eyebrow, title, price, note, features, accent = false, actionLabel }) {
  return (
    <article className={accent ? "panel plan-card plan-card-accent" : "panel plan-card"}>
      <p className="eyebrow">{eyebrow}</p>
      <h3>{title}</h3>
      <span className="plan-price">{price}</span>
      <p className="plan-note">{note}</p>
      <div className="plan-feature-list">
        {features.map((item) => (
          <span className="plan-feature" key={item}>
            {item}
          </span>
        ))}
      </div>
      <div className="plan-card-action">
        <TrackedLink
          className={accent ? "primary-link" : "ghost-link"}
          eventLabel={title}
          eventSource="pricing-page"
          href="/pricing#ton-payment-layer"
        >
          {actionLabel}
        </TrackedLink>
      </div>
    </article>
  );
}

export default async function PricingPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE</p>
        <h1>{isRu ? "Тарифы" : "Pricing"}</h1>
        <p>
          {isRu
            ? "Подписки ещё не подключены. Сейчас это чистая заготовка под будущий TON-платёжный слой: сначала testnet, потом smoke tests, потом mainnet."
            : "Subscriptions are not live yet. This is a clean placeholder for the future TON payment layer: testnet first, then smoke tests, then mainnet."}
        </p>
      </section>

      <section className="plan-grid">
        <PlanCard
          eyebrow="Free"
          title="Free"
          price="0 TON"
          note={
            isRu
              ? "Для первого знакомства с BOSE, Mini App и базовыми Telegram-сценариями."
              : "For the first look at BOSE, the Mini App, and basic Telegram workflows."
          }
          features={[isRu ? "Mini App" : "Mini App", isRu ? "Базовый бот" : "Core bot", isRu ? "Демо-режим" : "Demo Mode"]}
          actionLabel={isRu ? "Скоро" : "Coming soon"}
        />
        <PlanCard
          accent
          eyebrow="Pro"
          title="Pro"
          price={isRu ? "Скоро" : "Soon"}
          note={
            isRu
              ? "Для небольших команд: клиенты, сделки, задачи, AI-сводка и основа удержания."
              : "For small teams: clients, deals, tasks, AI summaries, and retention basics."
          }
          features={[isRu ? "Клиенты и сделки" : "Clients and deals", isRu ? "AI-сводка" : "AI summary", isRu ? "Основа удержания" : "Retention foundation"]}
          actionLabel={isRu ? "Оставить интерес" : "Join waitlist"}
        />
        <PlanCard
          eyebrow="Business"
          title="Business"
          price={isRu ? "Скоро" : "Soon"}
          note={
            isRu
              ? "Для команд, которым нужен режим владельца, запусковые метрики и будущий платёжный слой."
              : "For teams that need owner mode, launch metrics, and the future payment layer."}
          features={[isRu ? "Режим владельца" : "Owner mode", isRu ? "Аналитика запуска" : "Launch analytics", isRu ? "Платёжный слой" : "Payment layer"]}
          actionLabel={isRu ? "Смотреть план" : "View plan"}
        />
      </section>

      <section className="panel" id="ton-payment-layer">
        <div className="section-title">
          <p className="eyebrow">TON Payment Layer</p>
          <h2>{isRu ? "Что будет дальше" : "What comes next"}</h2>
        </div>
        <div className="workboard-stack">
          <article className="work-item">
            <div>
              <strong>{isRu ? "Этап 1" : "Stage 1"}</strong>
              <p>{isRu ? "TON Testnet и smoke tests без реальных списаний." : "TON testnet and smoke tests without real charges."}</p>
            </div>
          </article>
          <article className="work-item">
            <div>
              <strong>{isRu ? "Этап 2" : "Stage 2"}</strong>
              <p>{isRu ? "Проверка сценариев подписки и статусов доступа." : "Subscription flow and access status verification."}</p>
            </div>
          </article>
          <article className="work-item">
            <div>
              <strong>{isRu ? "Этап 3" : "Stage 3"}</strong>
              <p>{isRu ? "Mainnet после реальных пользователей и подтверждённого сценария оплаты." : "Mainnet only after real users and a validated payment path."}</p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
