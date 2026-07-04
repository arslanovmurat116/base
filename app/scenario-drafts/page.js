import { notFound } from "next/navigation";
import OwnerScenarioDraftsList from "../../components/owner-scenario-drafts-list";
import TrackedLink from "../../components/tracked-link";
import { getLanguage } from "../../lib/i18n-server";
import { getOwnerAccessState } from "../../lib/owner-access-server";
import { getScenarioDraftsData } from "../../lib/server-data";

export const metadata = {
  title: "Scenario Drafts | BOSE"
};

export default async function ScenarioDraftsPage() {
  const [lang, ownerAccess, drafts] = await Promise.all([
    getLanguage(),
    getOwnerAccessState(),
    getScenarioDraftsData({ limit: 100 })
  ]);
  const isRu = lang === "ru";

  if (!ownerAccess.isOwner) {
    notFound();
  }

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Owner</p>
        <h1>{isRu ? "Черновики сценариев" : "Scenario drafts"}</h1>
        <p>
          {isRu
            ? "Здесь BOSE собирает реальные запросы на автоматизацию из демо-страницы и Telegram-бота."
            : "BOSE collects real automation requests here from the demo page and the Telegram bot."}
        </p>
      </section>

      <section className="panel">
        <div className="quick-link-row">
          <TrackedLink className="ghost-link" eventLabel="Owner Mode" eventSource="scenario-drafts" href="/owner">
            {isRu ? "Режим владельца" : "Owner mode"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Dashboard" eventSource="scenario-drafts" href="/dashboard">
            {isRu ? "Панель" : "Dashboard"}
          </TrackedLink>
        </div>
      </section>

      <section className="workboard-stack">
        <OwnerScenarioDraftsList initialDrafts={drafts} lang={lang} />
      </section>
    </main>
  );
}
