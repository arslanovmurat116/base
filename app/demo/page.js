import DemoScenarioDiscoveryForm from "../../components/demo-scenario-discovery-form";
import TrackedLink from "../../components/tracked-link";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Demo Mode | BOSE"
};

export default async function DemoPage() {
  const lang = await getLanguage();
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{isRu ? "Демо-режим" : "Demo Mode"}</p>
        <h1>{isRu ? "Покажите BOSE ваш реальный процесс" : "Show BOSE your real workflow"}</h1>
        <p>
          {isRu
            ? "Опишите, что именно вы хотите автоматизировать. BOSE сохранит запрос, соберёт черновик сценария и покажет, с чего можно начать."
            : "Describe what you want to automate. BOSE will save the request, draft the scenario, and show the first step to automate."}
        </p>
      </section>

      <DemoScenarioDiscoveryForm lang={lang} />

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Дополнительно" : "Also explore"}</p>
          <h2>{isRu ? "Готовые поверхности BOSE" : "Ready BOSE surfaces"}</h2>
        </div>
        <div className="quick-link-row">
          <TrackedLink className="primary-link" eventLabel="Open Workspace" eventSource="demo-page" href="/dashboard">
            {isRu ? "Открыть BOSE" : "Open workspace"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Demo Clients" eventSource="demo-page" href="/clients">
            {isRu ? "Клиенты" : "Clients"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Demo Deals" eventSource="demo-page" href="/deals">
            {isRu ? "Сделки" : "Deals"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Demo Tasks" eventSource="demo-page" href="/tasks">
            {isRu ? "Задачи" : "Tasks"}
          </TrackedLink>
          <TrackedLink className="ghost-link" eventLabel="Demo AI" eventSource="demo-page" href="/ai">
            AI
          </TrackedLink>
        </div>
      </section>
    </main>
  );
}
