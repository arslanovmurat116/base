import { notFound } from "next/navigation";
import TrackedLink from "../../components/tracked-link";
import { getLaunchDebugData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";
import { getOwnerAccessState } from "../../lib/owner-access-server";

export const metadata = {
  title: "System Check | BOSE"
};

function StatusRow({ item }) {
  return (
    <article className="work-item">
      <div>
        <strong>{item.label}</strong>
        <p>{item.detail}</p>
      </div>
      <span className={item.ok ? "offer-feature" : "chip-soft"}>{item.ok ? "OK" : "Check"}</span>
    </article>
  );
}

export default async function TestPage() {
  const [lang, ownerAccess, debug] = await Promise.all([getLanguage(), getOwnerAccessState(), getLaunchDebugData()]);
  const isRu = lang === "ru";

  if (!ownerAccess.isOwner) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE System Check</p>
        <h1>{isRu ? "Системная проверка" : "System checklist"}</h1>
        <p>
          {isRu
            ? "Внутренняя страница для проверки webhook, базы, аналитики, Mini App auth, AI и retention."
            : "Internal page for webhook, database, analytics, Mini App auth, AI, and retention checks."}
        </p>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">Checks</p>
            <h2>{isRu ? "Что уже готово" : "What is ready"}</h2>
          </div>
          <div className="workboard-stack">
            {debug.checklist.map((item) => (
              <StatusRow item={item} key={item.key} />
            ))}
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">Launch Metrics</p>
            <h2>{isRu ? "Живые цифры" : "Live counters"}</h2>
          </div>
          <div className="focus-grid">
            {[
              ["Users", debug.metrics.usersTotal],
              ["Active", debug.metrics.activeUsers],
              ["Daily", debug.metrics.dailyUsers],
              ["Weekly", debug.metrics.weeklyUsers],
              ["Monthly", debug.metrics.monthlyUsers],
              ["New", debug.metrics.newUsers],
              ["Sessions", debug.metrics.sessionsTotal],
              ["Analytics", debug.metrics.analyticsEventsTotal]
            ].map(([label, value]) => (
              <article className="focus-card" key={label}>
                <span className="eyebrow">{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="quick-link-row">
            <span className="offer-feature">{`Ready: ${debug.retention?.campaigns?.ready || 0}`}</span>
            <span className="chip-soft">{`Scheduled: ${debug.retention?.campaigns?.scheduled || 0}`}</span>
          </div>
        </article>
      </section>

      <section className="panel">
        <div className="quick-link-row">
          <TrackedLink className="ghost-link" eventLabel="Owner" eventSource="test-page" href="/owner">
            /owner
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Health API" eventSource="test-page" href="/api/system/health">
            /api/system/health
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Mini App Auth API" eventSource="test-page" href="/api/telegram/miniapp/auth">
            /api/telegram/miniapp/auth
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Privacy" eventSource="test-page" href="/privacy">
            /privacy
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Terms" eventSource="test-page" href="/terms">
            /terms
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
