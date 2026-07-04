import { notFound } from "next/navigation";
import TrackedLink from "../../components/tracked-link";
import { getEnvironmentPublicSummary } from "../../lib/env";
import { getLanguage } from "../../lib/i18n-server";
import { getOwnerAccessState } from "../../lib/owner-access-server";
import { getLaunchDebugData } from "../../lib/server-data";
import { getTelegramRetentionMetrics } from "../../lib/telegram/analytics";

export const metadata = {
  title: "Owner | BOSE"
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

export default async function OwnerPage() {
  const [lang, ownerAccess, debug, retention] = await Promise.all([
    getLanguage(),
    getOwnerAccessState(),
    getLaunchDebugData(),
    getTelegramRetentionMetrics()
  ]);
  const isRu = lang === "ru";

  if (!ownerAccess.isOwner) {
    notFound();
  }

  const env = getEnvironmentPublicSummary();

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Owner</p>
        <h1>{isRu ? "Внутренний режим BOSE" : "BOSE owner mode"}</h1>
        <p>
          {isRu
            ? "Диагностика, внутренние ссылки и запусковые метрики. Это видит только владелец и локальный предпросмотр."
            : "Diagnostics, internal links, and launch metrics. This surface is visible only to the owner and local preview."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Статус запуска" : "Launch status"}</p>
          <h2>{isRu ? "Что уже готово" : "What is ready"}</h2>
        </div>
        <div className="focus-grid">
          <MetricCard
            label={isRu ? "Пользователи" : "Users"}
            value={debug.metrics.usersTotal}
            note={isRu ? "Telegram identity и Mini App capture." : "Telegram identity and Mini App capture."}
          />
          <MetricCard
            label={isRu ? "Сессии" : "Sessions"}
            value={debug.metrics.sessionsTotal}
            note={isRu ? "Mini App sessions для аналитики и retention." : "Mini App sessions for analytics and retention."}
          />
          <MetricCard
            label={isRu ? "События" : "Events"}
            value={debug.metrics.analyticsEventsTotal}
            note={isRu ? "События бота и Mini App в Postgres." : "Bot and Mini App events stored in Postgres."}
          />
          <MetricCard
            label={isRu ? "Retention" : "Retention"}
            value={retention.campaigns.total}
            note={
              isRu
                ? `${retention.campaigns.ready} ready и ${retention.campaigns.scheduled} scheduled кампаний.`
                : `${retention.campaigns.ready} ready and ${retention.campaigns.scheduled} scheduled campaigns.`
            }
          />
        </div>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Проверки" : "Checks"}</p>
            <h2>{isRu ? "Критичные контуры" : "Critical surfaces"}</h2>
          </div>
          <div className="workboard-stack">
            {debug.checklist.map((item) => (
              <article className="work-item" key={item.key}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.detail}</p>
                </div>
                <span className={item.ok ? "offer-feature" : "chip-soft"}>{item.ok ? "OK" : "Check"}</span>
              </article>
            ))}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Retention" : "Retention"}</p>
            <h2>{isRu ? "Стадии пользователей" : "User lifecycle"}</h2>
          </div>
          <div className="workboard-stack">
            {[
              [isRu ? "Новые" : "New", retention.lifecycle.newUsers],
              [isRu ? "Активируются" : "Activated", retention.lifecycle.activatedUsers],
              [isRu ? "Вовлечённые" : "Engaged", retention.lifecycle.engagedUsers],
              [isRu ? "Спящие" : "Dormant", retention.lifecycle.dormantUsers],
              [isRu ? "Неактивные" : "Inactive", retention.lifecycle.inactiveUsers]
            ].map(([label, value]) => (
              <article className="work-item" key={label}>
                <div>
                  <strong>{label}</strong>
                  <p>{isRu ? "Текущая стадия по активности Telegram-пользователей." : "Current stage based on Telegram activity."}</p>
                </div>
                <span className="ghost-link">{value}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Внутренние ссылки" : "Internal links"}</p>
            <h2>{isRu ? "Инструменты владельца" : "Owner tools"}</h2>
          </div>
          <div className="quick-link-row">
            <TrackedLink className="ghost-link" eventLabel="Scenario Drafts" eventSource="owner-page" href="/scenario-drafts">
              {isRu ? "Запросы сценариев" : "Scenario Drafts"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="System Check" eventSource="owner-page" href="/test">
              {isRu ? "Системная проверка" : "System Check"}
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Health" eventSource="owner-page" href="/api/system/health">
              /api/system/health
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Webhook" eventSource="owner-page" href="/api/telegram/webhook">
              /api/telegram/webhook
            </TrackedLink>
            <TrackedLink className="ghost-link" eventLabel="Statistics" eventSource="owner-page" href="/api/core/statistics">
              /api/core/statistics
            </TrackedLink>
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">ENV</p>
            <h2>{isRu ? "Готовность окружения" : "Environment readiness"}</h2>
          </div>
          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{isRu ? "База" : "Database"}</strong>
                <p>
                  {env.database.liveReady
                    ? isRu
                      ? "Live Postgres настроен."
                      : "Live Postgres is configured."
                    : isRu
                      ? "Live Postgres настроен не полностью."
                      : "Live Postgres is not fully configured."}
                </p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>Telegram</strong>
                <p>
                  {env.telegram.botReady
                    ? isRu
                      ? "Токен бота настроен."
                      : "Bot token is configured."
                    : isRu
                      ? "Токен бота отсутствует."
                      : "Bot token is missing."}
                </p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>AI</strong>
                <p>
                  {env.ai.aiReady
                    ? isRu
                      ? "Live AI key настроен."
                      : "Live AI key is configured."
                    : isRu
                      ? "BOSE сейчас работает в AI fallback mode."
                      : "BOSE is using AI fallback mode."}
                </p>
              </div>
            </article>
          </div>
        </article>
      </section>
    </main>
  );
}
