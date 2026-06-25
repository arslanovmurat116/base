import TrackedLink from "../../components/tracked-link";
import { getAICRMSummary, getBOSEDashboardData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Dashboard | BOSE"
};

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
  return (
    <article className="work-item">
      <div>
        <strong>
          {href ? (
            <TrackedLink className="work-item-link" eventLabel={eventLabel || title} eventSource="dashboard" href={href}>
              {title}
            </TrackedLink>
          ) : (
            title
          )}
        </strong>
        <p>{meta}</p>
      </div>
    </article>
  );
}

export default async function DashboardPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";
  const [dashboard, aiSummary] = await Promise.all([getBOSEDashboardData(), getAICRMSummary()]);
  const stageBreakdown = Object.entries(dashboard.stageBreakdown || {});

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE RC1</p>
        <h1>{isRu ? "Панель BOSE" : "BOSE Dashboard"}</h1>
        <p>
          {isRu
            ? "Первый launch dashboard: users, sessions, clients, deals, задачи и живые события."
            : "The launch dashboard for users, sessions, clients, deals, tasks, and live business events."}
        </p>
      </section>

      <section className="panel">
        <div className="focus-grid">
          {dashboard.metrics.map((item) => (
            <MetricCard item={item} key={item.label} />
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
                <QueueEntry key={stage} title={stage} meta={`${total} deal(s)`} />
              ))
            ) : (
              <QueueEntry title="No stage data yet" meta="Core deals will appear here." />
            )}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">AI CRM Assistant</p>
            <h2>{isRu ? "Сводка дня" : "Daily digest"}</h2>
          </div>
          <div className="workboard-stack">
            <QueueEntry title={aiSummary.data?.dailyDigest || "No digest yet"} meta={aiSummary.reason || ""} />
            <QueueEntry
              title={aiSummary.data?.overdueTasks || "No overdue task summary"}
              meta={aiSummary.data?.workloadSummary || ""}
            />
            {(aiSummary.data?.managerRecommendations || []).map((item) => (
              <QueueEntry key={item} title={item} meta="Manager recommendation" />
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
            <h2>{isRu ? "Свежие записи" : "Recent records"}</h2>
          </div>
          <div className="workboard-stack">
            {dashboard.queues.clients.length ? (
              dashboard.queues.clients.map((item) => (
                <QueueEntry
                  key={item.id}
                  title={item.displayName}
                  meta={`${item.status} - ${item.primaryPhone || "No phone"}`}
                  href={`/clients/${item.id}`}
                  eventLabel={`client:${item.displayName}`}
                />
              ))
            ) : (
              <QueueEntry title="No clients yet" meta="Create the first Telegram lead or open demo mode." />
            )}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Сделки" : "Deals"}</p>
            <h2>{isRu ? "Свежие записи" : "Recent records"}</h2>
          </div>
          <div className="workboard-stack">
            {dashboard.queues.deals.length ? (
              dashboard.queues.deals.map((item) => (
                <QueueEntry
                  key={item.id}
                  title={item.title}
                  meta={`${item.stageKey} - ${item.client?.displayName || "No client"}`}
                  href={`/deals/${item.id}`}
                  eventLabel={`deal:${item.title}`}
                />
              ))
            ) : (
              <QueueEntry title="No deals yet" meta="Create the first Telegram lead or open demo mode." />
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
