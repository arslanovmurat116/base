import TrackedLink from "../../../components/tracked-link";
import EmptyStateActions from "../../../components/empty-state-actions";
import { getCoreDealById } from "../../../lib/server-data";
import { getLanguage } from "../../../lib/i18n-server";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const deal = await getCoreDealById(resolvedParams.id);

  return {
    title: deal ? `${deal.title} | BOSE` : "Deal | BOSE"
  };
}

export default async function DealDetailPage({ params }) {
  const lang = await getLanguage();
  const resolvedParams = await params;
  const deal = await getCoreDealById(resolvedParams.id);
  const isRu = lang === "ru";

  if (!deal) {
    return (
      <main className="page-shell">
        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">BOSE</p>
            <h1>{isRu ? "Сделка не найдена" : "Deal not found"}</h1>
          </div>
          <EmptyStateActions lang={lang} />
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Deal</p>
        <h1>{deal.title}</h1>
        <p>{deal.stageKey} - {deal.status} - {deal.client?.displayName || "No client"}</p>
      </section>

      <section className="workboard-grid">
        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Контекст" : "Context"}</p>
            <h2>{isRu ? "Сделка BOSE Core" : "BOSE core deal"}</h2>
          </div>
          <div className="workboard-stack">
            <article className="work-item">
              <div>
                <strong>{isRu ? "Клиент" : "Client"}</strong>
                <p>{deal.client?.displayName || "Not linked"}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Оценка" : "Estimate"}</strong>
                <p>{deal.amountEstimate != null ? `${deal.amountEstimate} ${deal.currency}` : "No estimate yet"}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Ответственный" : "Owner"}</strong>
                <p>{deal.owner?.name || (isRu ? "Не назначен" : "Unassigned")}</p>
              </div>
            </article>
          </div>
        </article>

        <article className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">{isRu ? "Следующие действия" : "Next clicks"}</p>
            <h2>{isRu ? "Куда перейти дальше" : "Where to go next"}</h2>
          </div>
          <div className="workboard-stack">
            {deal.lead?.slug ? (
              <article className="work-item">
                <div>
                  <strong>Legacy lead card</strong>
                  <p>
                    {isRu
                      ? "Совместимый экран со всей старой мебельной логикой."
                      : "Compatibility screen with the existing legacy lead flow."}
                  </p>
                </div>
                <TrackedLink
                  className="ghost-link"
                  eventLabel={`legacy:${deal.title}`}
                  eventSource="deal-detail"
                  href={`/leads/${deal.lead.slug}`}
                >
                  {isRu ? "Открыть карточку" : "Open card"}
                </TrackedLink>
              </article>
            ) : null}
            {deal.recentEvents?.length ? (
              deal.recentEvents.map((event) => (
                <article className="work-item" key={event.id}>
                  <div>
                    <strong>{event.eventName}</strong>
                    <p>{event.occurredAt || "n/a"}</p>
                  </div>
                </article>
              ))
            ) : (
              <>
                <p>{isRu ? "Для этой сделки пока нет свежих событий." : "No recent events are stored for this deal yet."}</p>
                <EmptyStateActions lang={lang} />
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
