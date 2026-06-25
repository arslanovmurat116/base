import TrackedLink from "./tracked-link";

export default function EmptyStateActions({ lang = "en" }) {
  const labels =
    lang === "ru"
      ? {
          createClient: "Создать клиента",
          createDeal: "Создать сделку",
          addTask: "Добавить задачу",
          askAI: "Спросить AI"
        }
      : {
          createClient: "Create Client",
          createDeal: "Create Deal",
          addTask: "Add Task",
          askAI: "Ask AI"
        };

  return (
    <div className="quick-link-row">
      <TrackedLink className="ghost-link" eventLabel={labels.createClient} eventSource="empty-state" href="/clients">
        {labels.createClient}
      </TrackedLink>
      <TrackedLink className="ghost-link" eventLabel={labels.createDeal} eventSource="empty-state" href="/deals">
        {labels.createDeal}
      </TrackedLink>
      <TrackedLink className="ghost-link" eventLabel={labels.addTask} eventSource="empty-state" href="/tasks">
        {labels.addTask}
      </TrackedLink>
      <TrackedLink className="ghost-link" eventLabel={labels.askAI} eventSource="empty-state" href="/ai">
        {labels.askAI}
      </TrackedLink>
    </div>
  );
}
