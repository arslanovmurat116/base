import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
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
            ? "Core-сделки, уже связанные с клиентами и готовые к просмотру в Mini App."
            : "Core deals already linked to clients and ready to be explored inside the Mini App."}
        </p>
      </section>

      <section className="panel">
        {!deals.length ? (
          <>
            <div className="section-title">
              <p className="eyebrow">{isRu ? "Пусто" : "Empty state"}</p>
              <h2>{isRu ? "Сделок пока нет" : "No deals yet"}</h2>
            </div>
            <EmptyStateActions lang={lang} />
          </>
        ) : (
          <div className="workboard-stack">
            {deals.map((deal) => (
              <article className="work-item" key={deal.id}>
                <div>
                  <strong>{deal.title}</strong>
                  <p>
                    {deal.stageKey} - {deal.client?.displayName || "No client"} -{" "}
                    {deal.amountEstimate != null ? `${deal.amountEstimate} ${deal.currency}` : "No estimate"}
                  </p>
                </div>
                <TrackedLink
                  className="ghost-link"
                  eventLabel={`deal:${deal.title}`}
                  eventSource="deals-list"
                  href={`/deals/${deal.id}`}
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
