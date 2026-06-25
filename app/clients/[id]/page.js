import TrackedLink from "../../../components/tracked-link";
import EmptyStateActions from "../../../components/empty-state-actions";
import { getCoreClientById } from "../../../lib/server-data";
import { getLanguage } from "../../../lib/i18n-server";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const client = await getCoreClientById(resolvedParams.id);

  return {
    title: client ? `${client.displayName} | BOSE` : "Client | BOSE"
  };
}

export default async function ClientDetailPage({ params }) {
  const lang = await getLanguage();
  const resolvedParams = await params;
  const client = await getCoreClientById(resolvedParams.id);
  const isRu = lang === "ru";

  if (!client) {
    return (
      <main className="page-shell">
        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">BOSE</p>
            <h1>{isRu ? "Клиент не найден" : "Client not found"}</h1>
          </div>
          <EmptyStateActions lang={lang} />
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Client</p>
        <h1>{client.displayName}</h1>
        <p>
          {client.primaryPhone || "No phone"} - {client.status}
        </p>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Профиль" : "Profile"}</p>
            <h2>{isRu ? "Основные данные" : "Core details"}</h2>
          </div>
          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{isRu ? "Владелец" : "Owner"}</strong>
                <p>{client.owner?.name || (isRu ? "Не назначен" : "Unassigned")}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>Telegram</strong>
                <p>{client.telegramUsername || client.telegramUserId || "Not linked yet"}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Сделки" : "Deals"}</strong>
                <p>
                  {client.stats?.totalDeals || 0} total - {client.stats?.openDeals || 0} open -{" "}
                  {client.stats?.wonDeals || 0} won
                </p>
              </div>
            </article>
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Связанные сделки" : "Related deals"}</p>
            <h2>{isRu ? "Куда перейти дальше" : "Where to click next"}</h2>
          </div>
          <div className="workboard-stack">
            {client.relatedDeals?.length ? (
              client.relatedDeals.map((deal) => (
                <article className="work-item" key={deal.id}>
                  <div>
                    <strong>{deal.title}</strong>
                    <p>
                      {deal.stageKey} - {deal.status}
                    </p>
                  </div>
                  <TrackedLink
                    className="ghost-link"
                    eventLabel={`deal:${deal.title}`}
                    eventSource="client-detail"
                    href={`/deals/${deal.id}`}
                  >
                    {isRu ? "Открыть" : "Open"}
                  </TrackedLink>
                </article>
              ))
            ) : (
              <>
                <p>{isRu ? "У клиента пока нет связанных сделок." : "No deals are linked to this client yet."}</p>
                <EmptyStateActions lang={lang} />
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
