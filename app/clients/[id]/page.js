import TrackedLink from "../../../components/tracked-link";
import EmptyStateActions from "../../../components/empty-state-actions";
import { getCoreClientById } from "../../../lib/server-data";
import { getLanguage } from "../../../lib/i18n-server";

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

function localizeDealStage(stage, lang) {
  const map = {
    new: { en: "new", ru: "новая" },
    contacted: { en: "contacted", ru: "контакт" },
    qualified: { en: "qualified", ru: "квалификация" },
    appointment: { en: "appointment", ru: "встреча" },
    proposal: { en: "proposal", ru: "предложение" },
    won: { en: "won", ru: "успех" },
    lost: { en: "lost", ru: "потеря" }
  };
  const entry = map[String(stage || "").toLowerCase()];
  return entry ? entry[lang === "ru" ? "ru" : "en"] : stage;
}

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
          {client.primaryPhone || (isRu ? "Телефон не указан" : "No phone")} - {localizeClientStatus(client.status, lang)}
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
                <strong>{isRu ? "Ответственный" : "Owner"}</strong>
                <p>{client.owner?.name || (isRu ? "Не назначен" : "Unassigned")}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>Telegram</strong>
                <p>{client.telegramUsername || client.telegramUserId || (isRu ? "Пока не привязан" : "Not linked yet")}</p>
              </div>
            </article>
            <article className="work-item">
              <div>
                <strong>{isRu ? "Сделки" : "Deals"}</strong>
                <p>
                  {client.stats?.totalDeals || 0} {isRu ? "всего" : "total"} - {client.stats?.openDeals || 0}{" "}
                  {isRu ? "открыто" : "open"} - {client.stats?.wonDeals || 0} {isRu ? "выиграно" : "won"}
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
                      {localizeDealStage(deal.stageKey, lang)} - {deal.status}
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
