import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getCoreDealsData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Deals | BOSE"
};

export default async function DealsPage() {
  const lang = await getLanguage();
  const deals = await getCoreDealsData({ limit: 24 });
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE</p>
        <h1>{isRu ? "Сделки" : "Deals"}</h1>
        <p>
          {isRu
            ? "Сделки, связанные с клиентами и готовые к дальнейшей работе внутри BOSE."
            : "Deals linked to clients and ready to move forward inside the workspace."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Навигация по сделкам" : "Deal workspace shortcuts"}</h2>
        </div>
        <WorkspaceShortcuts lang={lang} eventSource="deals-shortcuts" items={["dashboard", "clients", "tasks", "ai"]} />
      </section>

      <section className="panel">
        {!deals.length ? (
          <>
            <div className="section-title">
              <p className="eyebrow">{isRu ? "Пусто" : "Empty state"}</p>
              <h2>{isRu ? "Сделок пока нет" : "No deals yet"}</h2>
            </div>
            <p>
              {isRu
                ? "Создай первую заявку через Telegram, включи demo-режим или спроси AI, с чего начать."
                : "Create the first Telegram request, open demo mode, or ask AI what to do next."}
            </p>
            <EmptyStateActions lang={lang} />
          </>
        ) : (
          <div className="workboard-stack">
            {deals.map((deal) => (
              <TrackedLink
                className="queue-item-link-card"
                eventLabel={`deal:${deal.title}`}
                eventSource="deals-list"
                href={`/deals/${deal.id}`}
                key={deal.id}
              >
                <article className="work-item">
                  <div>
                    <strong>{deal.title}</strong>
                    <p>
                      {deal.stageKey} - {deal.client?.displayName || "No client"} -{" "}
                      {deal.amountEstimate != null ? `${deal.amountEstimate} ${deal.currency}` : "No estimate"}
                    </p>
                  </div>
                  <span className="ghost-link">{isRu ? "Открыть" : "Open"}</span>
                </article>
              </TrackedLink>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
