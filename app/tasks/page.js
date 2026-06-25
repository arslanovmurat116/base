import TrackedLink from "../../components/tracked-link";
import EmptyStateActions from "../../components/empty-state-actions";
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
            ? "Командные задачи из текущего рабочего контура. Legacy lead-слой ещё живёт рядом, но Tasks уже можно кликать как BOSE surface."
            : "Team tasks from the current working loop. The legacy lead layer still exists, but tasks are already usable as a BOSE surface."}
        </p>
      </section>

      <section className="panel">
        {!tasks.length ? (
          <>
            <div className="section-title">
              <p className="eyebrow">{isRu ? "Пусто" : "Empty state"}</p>
              <h2>{isRu ? "Задач пока нет" : "No tasks yet"}</h2>
            </div>
            <EmptyStateActions lang={lang} />
          </>
        ) : (
          <div className="workboard-stack">
            {tasks.map((task, index) => (
              <article className="work-item" key={`${task.title || "task"}-${index}`}>
                <div>
                  <strong>{task.title || (isRu ? "Задача" : "Task")}</strong>
                  <p>
                    {task.laneLabel} - {task.owner || task.ownerName || "Unassigned"} -{" "}
                    {task.dueDate || task.deadline || "No deadline"}
                  </p>
                </div>
                {task.slug ? (
                  <TrackedLink
                    className="ghost-link"
                    eventLabel={`task:${task.title || "task"}`}
                    eventSource="tasks-list"
                    href={`/leads/${task.slug}`}
                  >
                    {isRu ? "Открыть lead" : "Open lead"}
                  </TrackedLink>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
