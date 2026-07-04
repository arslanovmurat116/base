import ScenarioRequestForm from "../../components/scenario-request-form";
import TrackedLink from "../../components/tracked-link";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Scenario Request | BOSE"
};

export default async function ScenarioRequestPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{isRu ? "Mini App" : "Mini App"}</p>
        <h1>{isRu ? "Заказать сценарий" : "Order a scenario"}</h1>
        <p>
          {isRu
            ? "Эта форма собирает реальный запрос на автоматизацию из Telegram Mini App и передаёт его владельцу BOSE для просмотра и экспорта в WorkHub."
            : "This form captures a real automation request from the Telegram Mini App and sends it to the BOSE owner for review and WorkHub export."}
        </p>
      </section>

      <ScenarioRequestForm lang={lang} />

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Дальше" : "Next"}</p>
          <h2>{isRu ? "Что произойдёт после отправки" : "What happens after you submit"}</h2>
        </div>
        <div className="quick-link-row">
          <TrackedLink className="ghost-link" eventLabel="Open Dashboard" eventSource="scenario-request-page" href="/dashboard">
            {isRu ? "Открыть BOSE" : "Open BOSE"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Open Demo Mode" eventSource="scenario-request-page" href="/demo">
            {isRu ? "Демо-режим" : "Demo mode"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Open Tasks" eventSource="scenario-request-page" href="/tasks">
            {isRu ? "Задачи" : "Tasks"}
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
