import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getCoreClientsData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Clients | BOSE"
};

function localizeClientStatus(status, lang) {
  const map = {
    prospect: { en: "PROSPECT", ru: "лид" },
    active: { en: "ACTIVE", ru: "активен" },
    dormant: { en: "DORMANT", ru: "пауза" },
    archived: { en: "ARCHIVED", ru: "архив" }
  };
  const entry = map[String(status || "").toLowerCase()];
  return entry ? entry[lang === "ru" ? "ru" : "en"] : status;
}

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
            ? "Список клиентов, с которыми BOSE уже работает через Telegram и Mini App."
            : "A clear list of clients already captured inside BOSE through Telegram and the Mini App."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Навигация по клиентам" : "Client workspace shortcuts"}</h2>
        </div>
        <WorkspaceShortcuts lang={lang} eventSource="clients-shortcuts" items={["dashboard", "deals", "tasks", "ai", "pricing"]} />
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
                ? "Можно начать с Demo Mode, создать первую заявку через бота или сразу спросить AI."
                : "Start with Demo Mode, create the first Telegram request, or ask AI for the next step."}
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
                      {client.primaryPhone || (isRu ? "Телефон не указан" : "No phone")} -{" "}
                      {localizeClientStatus(client.status, lang)} - {client.stats?.totalDeals || 0}{" "}
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
