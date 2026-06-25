import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getCoreClientsData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Clients | BOSE"
};

export default async function ClientsPage() {
  const lang = await getLanguage();
  const clients = await getCoreClientsData({ limit: 24 });
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE</p>
        <h1>{isRu ? "Клиенты" : "Clients"}</h1>
        <p>
          {isRu
            ? "Список клиентов, с которыми уже работает пространство BOSE."
            : "A clear list of clients already captured inside the BOSE workspace."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Навигация по клиентам" : "Client workspace shortcuts"}</h2>
        </div>
        <WorkspaceShortcuts lang={lang} eventSource="clients-shortcuts" items={["dashboard", "deals", "tasks", "ai"]} />
      </section>

      <section className="panel">
        {!clients.length ? (
          <>
            <div className="section-title">
              <p className="eyebrow">{isRu ? "Пусто" : "Empty state"}</p>
              <h2>{isRu ? "Клиентов пока нет" : "No clients yet"}</h2>
            </div>
            <p>
              {isRu
                ? "Можно начать с demo-режима, создать первую заявку через бота или сразу спросить AI."
                : "Start with demo data, create the first Telegram request, or ask AI for the next step."}
            </p>
            <EmptyStateActions lang={lang} />
          </>
        ) : (
          <div className="workboard-stack">
            {clients.map((client) => (
              <TrackedLink
                className="queue-item-link-card"
                eventLabel={`client:${client.displayName}`}
                eventSource="clients-list"
                href={`/clients/${client.id}`}
                key={client.id}
              >
                <article className="work-item">
                  <div>
                    <strong>{client.displayName}</strong>
                    <p>
                      {client.primaryPhone || "No phone"} - {client.status} - {client.stats?.totalDeals || 0}{" "}
                      {isRu ? "сделок" : "deal(s)"}
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
