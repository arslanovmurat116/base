import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
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
            ? "Все клиентские записи, которые уже живут в core-слое и готовы к тестовому запуску."
            : "Client records already living in the BOSE core layer and ready for the Telegram launch."}
        </p>
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
              <article className="work-item" key={client.id}>
                <div>
                  <strong>{client.displayName}</strong>
                  <p>
                    {client.primaryPhone || "No phone"} - {client.status} - {client.stats?.totalDeals || 0}{" "}
                    {isRu ? "сделок" : "deal(s)"}
                  </p>
                </div>
                <TrackedLink
                  className="ghost-link"
                  eventLabel={`client:${client.displayName}`}
                  eventSource="clients-list"
                  href={`/clients/${client.id}`}
                >
                  {isRu ? "Открыть" : "Open"}
                </TrackedLink>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
