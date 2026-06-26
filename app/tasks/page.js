import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
import WorkspaceShortcuts from "../../components/workspace-shortcuts";
import { getTasksData } from "../../lib/server-data";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Tasks | BOSE"
};

function flattenTasks(columns = []) {
  return (Array.isArray(columns) ? columns : []).flatMap((column) =>
    (Array.isArray(column?.items) ? column.items : []).map((item) => ({
      ...item,
      laneLabel: column.title || column.label || column.id || "Queue"
    }))
  );
}

function formatLaneLabel(value, lang) {
  const source = String(value || "");

  if (lang === "ru") {
    if (source === "Urgent") {
      return "Срочно";
    }

    if (source === "In progress") {
      return "В работе";
    }

    if (source === "Closing") {
      return "На дожим";
    }

    return source;
  }

  if (source === "Срочно") {
    return "Urgent";
  }

  if (source === "В работе") {
    return "In progress";
  }

  if (source === "На дожим") {
    return "Closing";
  }

  return source;
}

export default async function TasksPage() {
  const lang = await getLanguage();
  const columns = await getTasksData();
  const tasks = flattenTasks(columns).slice(0, 40);
  const isRu = lang === "ru";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">BOSE</p>
        <h1>{isRu ? "Задачи" : "Tasks"}</h1>
        <p>
          {isRu
            ? "Задачи, которые помогают команде двигать клиентов и сделки вперёд."
            : "Tasks that help the team move clients and deals forward."}
        </p>
      </section>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">{isRu ? "Быстрый старт" : "Quick start"}</p>
          <h2>{isRu ? "Навигация по задачам" : "Task workspace shortcuts"}</h2>
        </div>
        <WorkspaceShortcuts lang={lang} eventSource="tasks-shortcuts" items={["dashboard", "clients", "deals", "ai", "pricing"]} />
      </section>

      <section className="panel">
        {!tasks.length ? (
          <>
            <div className="section-title">
              <p className="eyebrow">{isRu ? "Пусто" : "Empty state"}</p>
              <h2>{isRu ? "Задач пока нет" : "No tasks yet"}</h2>
            </div>
            <p>
              {isRu
                ? "Сначала создай клиента, сделку или заявку через Telegram, и задачи появятся автоматически."
                : "Create a client, a deal, or a Telegram request first, and BOSE will start generating tasks."}
            </p>
            <EmptyStateActions lang={lang} />
          </>
        ) : (
          <div className="workboard-stack">
            {tasks.map((task, index) => (
              <article className="work-item" key={`${task.title || "task"}-${index}`}>
                <div>
                  <strong>{task.title || (isRu ? "Задача" : "Task")}</strong>
                  <p>
                    {formatLaneLabel(task.laneLabel, lang)} - {task.owner || task.ownerName || (isRu ? "Не назначен" : "Unassigned")} -{" "}
                    {task.dueDate || task.deadline || (isRu ? "Без дедлайна" : "No deadline")}
                  </p>
                </div>
                {task.slug ? (
                  <TrackedLink
                    className="ghost-link"
                    eventLabel={`task:${task.title || "task"}`}
                    eventSource="tasks-list"
                    href={`/leads/${task.slug}`}
                  >
                    {isRu ? "Открыть запись" : "Open record"}
                  </TrackedLink>
                ) : (
                  <span className="ghost-link">{isRu ? "Без записи" : "No record"}</span>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
