import TrackedLink from "../../components/tracked-link";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Pricing | BOSE"
};

const TELEGRAM_BOT_HREF = "https://t.me/bose_business_os_bot";

function PlanCard({ eyebrow, title, price, note, features, accent = false, actionLabel, href }) {
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
          href={href}
          rel={href.startsWith("https://") ? "noreferrer" : undefined}
          target={href.startsWith("https://") ? "_blank" : undefined}
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
            ? "Оплата внутри приложения появится позже. Сейчас доступ и подключение оформляются вручную через бота BOSE."
            : "In-app payments will be added later. For now, access and setup are handled manually through the BOSE bot."}
        </p>
      </section>

      <section className="plan-grid">
        <PlanCard
          eyebrow="Free"
          title="Free"
          price={isRu ? "Бесплатно" : "Free"}
          note={
            isRu
              ? "Для первого знакомства с BOSE, Mini App и базовыми сценариями."
              : "For the first look at BOSE, the Mini App, and the basic workflows."
          }
          features={[
            "Mini App",
            isRu ? "Базовый бот" : "Core bot",
            isRu ? "Демо-режим" : "Demo Mode"
          ]}
          actionLabel={isRu ? "Открыть BOSE" : "Open BOSE"}
          href="/dashboard"
        />
        <PlanCard
          accent
          eyebrow="Pro"
          title="Pro"
          price={isRu ? "Позже" : "Later"}
          note={
            isRu
              ? "Для небольших команд: клиенты, сделки, задачи, AI-сводки и рабочий контур в одном месте."
              : "For small teams: clients, deals, tasks, AI summaries, and the operating loop in one place."
          }
          features={[
            isRu ? "Клиенты и сделки" : "Clients and deals",
            isRu ? "AI-сводки" : "AI summaries",
            isRu ? "Командная работа" : "Team workflows"
          ]}
          actionLabel={isRu ? "Написать в бота" : "Contact in bot"}
          href={TELEGRAM_BOT_HREF}
        />
        <PlanCard
          eyebrow="Business"
          title="Business"
          price={isRu ? "Позже" : "Later"}
          note={
            isRu
              ? "Для команд, которым нужен режим владельца, аналитика запуска и расширенный доступ."
              : "For teams that need owner mode, launch analytics, and expanded access."
          }
          features={[
            isRu ? "Режим владельца" : "Owner mode",
            isRu ? "Аналитика запуска" : "Launch analytics",
            isRu ? "Расширенный доступ" : "Expanded access"
          ]}
          actionLabel={isRu ? "Оставить интерес" : "Leave interest"}
          href={TELEGRAM_BOT_HREF}
        />
      </section>

      <section className="panel" id="access-later">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Позже" : "Later"}</p>
          <h2>{isRu ? "Как это будет работать" : "How this will work"}</h2>
        </div>
        <div className="workboard-stack">
          <article className="work-item">
            <div>
              <strong>{isRu ? "Сейчас" : "Now"}</strong>
              <p>
                {isRu
                  ? "Ты можешь открыть BOSE, посмотреть демо и поработать через бота."
                  : "You can open BOSE, explore the demo, and work through the bot."}
              </p>
            </div>
          </article>
          <article className="work-item">
            <div>
              <strong>{isRu ? "Подключение" : "Setup"}</strong>
              <p>
                {isRu
                  ? "Если нужен доступ для команды, пока подключаем вручную через бота."
                  : "If you need team access, we handle setup manually through the bot for now."}
              </p>
            </div>
          </article>
          <article className="work-item">
            <div>
              <strong>{isRu ? "Дальше" : "Next"}</strong>
              <p>
                {isRu
                  ? "Оплата внутри приложения появится позже, когда мы подключим её в продукт."
                  : "In-app payments will appear later, once they are enabled in the product."}
              </p>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
