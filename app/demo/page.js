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
        <p className="eyebrow">Demo Mode</p>
        <h1>{isRu ? "Demo-режим без регистрации" : "Demo mode without registration"}</h1>
        <p>
          {isRu
            ? "Здесь можно быстро прокликать BOSE как тестовый пользователь: клиенты, сделки, задачи и AI."
            : "This is the fast no-registration path: click through clients, deals, tasks, and AI."}
        </p>
      </section>

      <section className="panel">
        <div className="quick-link-row">
          <TrackedLink className="primary-link" eventLabel="Open Workspace" eventSource="demo-page" href="/dashboard">
            {isRu ? "Открыть Workspace" : "Open Workspace"}
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
