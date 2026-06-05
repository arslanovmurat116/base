import Link from "next/link";
import FilterBar from "../../components/filter-bar";
import FollowupCompleteButton from "../../components/followup-complete-button";
import TaskCompleteButton from "../../components/task-complete-button";
import {
  getLeadAlertHref,
  getLeadAppointmentHref,
  getLeadFollowupHref,
  getLeadStatusHref,
  getLeadTaskHref
} from "../../lib/lead-links";
import {
  getAppointmentsData,
  getFollowupsData,
  getLeadsData,
  getWorkboardData
} from "../../lib/server-data";

export const metadata = {
  title: "Смена | Mebel RDN CRM"
};

function FocusCard({ label, value, note, href }) {
  const content = (
    <>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </>
  );

  if (href) {
    return (
      <Link className="focus-card focus-card-link" href={href}>
        {content}
      </Link>
    );
  }

  return <article className="focus-card">{content}</article>;
}

function formatLeadStatus(status) {
  switch (status) {
    case "NEW":
      return "Новая заявка";
    case "CONTACTED":
      return "Связаться";
    case "QUALIFIED":
      return "Расчёт стоимости";
    case "MEETING":
      return "Замер назначен";
    case "PROPOSAL":
      return "Согласование";
    case "WON":
      return "Предоплата";
    case "LOST":
      return "Отказ";
    default:
      return status || "Сделка";
  }
}

function formatAppointmentType(type) {
  switch (type) {
    case "measurement":
      return "Замер";
    case "showroom":
      return "Шоурум";
    case "consultation":
      return "Консультация";
    case "call":
      return "Созвон";
    default:
      return type || "Встреча";
  }
}

function formatAppointmentStatus(status) {
  switch (status) {
    case "SCHEDULED":
      return "Назначено";
    case "CONFIRMED":
      return "Подтверждено";
    case "COMPLETED":
      return "Проведено";
    case "CANCELLED":
      return "Отменено";
    case "NO_SHOW":
      return "Не состоялось";
    default:
      return status;
  }
}

function LeadEntry({ item, note }) {
  const href = getLeadStatusHref(item.slug, item.status);
  return (
    <article className="work-item">
      <div>
        <strong>
          {href ? (
            <Link className="work-item-link" href={href}>
              {item.lead}
            </Link>
          ) : (
            item.lead
          )}
        </strong>
        <p>{note}</p>
      </div>
      <div className="work-meta">
        <span>{item.owner}</span>
        <strong>{item.deadline || item.scheduledAt}</strong>
        <em>{item.status ? formatLeadStatus(item.status) : item.type}</em>
      </div>
    </article>
  );
}

function getTaskHref(item) {
  const leadHref = getLeadTaskHref(item);

  if (leadHref) {
    return leadHref;
  }

  const text = `${item.lane || ""} ${item.tag || ""} ${item.title || ""}`.toLowerCase();

  if (text.includes("замер")) {
    return "/appointments?status=SCHEDULED";
  }

  if (text.includes("кп") || text.includes("расч") || text.includes("смет")) {
    return "/leads?status=QUALIFIED";
  }

  if (text.includes("дожим")) {
    return "/leads?status=PROPOSAL";
  }

  return "/workboard?view=estimates";
}

export default async function WorkboardPage({ searchParams }) {
  const resolved = await searchParams;
  const view = resolved?.view || "all";

  const [data, leads, followups, appointments] = await Promise.all([
    getWorkboardData(),
    getLeadsData(),
    getFollowupsData(),
    getAppointmentsData()
  ]);

  const focus = [
    {
      label: "Без первого ответа",
      value: String(leads.filter((lead) => lead.status === "NEW").length),
      note: "Новые входящие, которые нельзя оставлять без контакта."
    },
    {
      label: "На расчёт",
      value: String(
        leads.filter((lead) =>
          ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(lead.status)
        ).length
      ),
      note: "Сделки, где нужно посчитать стоимость, выдать диапазон и не потерять темп."
    },
    {
      label: "Замеры и встречи",
      value: String(
        appointments.filter((item) =>
          ["SCHEDULED", "CONFIRMED"].includes(item.status)
        ).length
      ),
      note: "Ближайшие выезды, шоурум и консультации."
    },
    {
      label: "Повторный контакт",
      value: String(followups.filter((item) => item.status === "PENDING").length),
      note: "Повторные контакты, где важно не потерять тёплый интерес клиента."
    }
  ];
  const linkedFocus = focus.map((item, index) => ({
    ...item,
    href:
      [
        "/leads?status=NEW",
        "/workboard?view=estimates",
        "/appointments",
        "/workboard?view=followups"
      ][index] || "/workboard"
  }));

  const upcomingMeasurements = [...appointments]
    .filter((item) => ["SCHEDULED", "CONFIRMED"].includes(item.status))
    .sort((first, second) => {
      const firstDate = first.scheduledAtIso
        ? new Date(first.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      const secondDate = second.scheduledAtIso
        ? new Date(second.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate;
    })
    .slice(0, 6);

  const showLeads = view === "all" || view === "intake";
  const showTasks = view === "all" || view === "estimates";
  const showMeasurements = view === "all" || view === "measurements";
  const showFollowups = view === "all" || view === "followups";
  const showAlerts = view === "all" || view === "alerts";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Смена</p>
        <h1>Одна рабочая очередь для менеджера и собственника</h1>
        <p>
          Здесь собран реальный дневной контур мебельной команды: кому
          позвонить, что посчитать, какой замер подтвердить и где уже нужен
          аккуратный дожим сделки.
        </p>
      </section>

      <section className="panel">
        <div className="section-badge-row">
          <span className="badge-soft">Без лишних модулей</span>
          <span className="badge-soft">Только входящий поток и следующий шаг</span>
        </div>

        <FilterBar
          title="Показать"
          paramKey="view"
          options={[
            { value: "all", label: "Всё" },
            { value: "intake", label: "Новые заявки" },
            { value: "estimates", label: "Расчёт" },
            { value: "measurements", label: "Замеры" },
            { value: "followups", label: "Повторный контакт" },
            { value: "alerts", label: "Риски" }
          ]}
        />

        <div className="focus-grid">
          {linkedFocus.map((item) => (
            <FocusCard key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="workboard-grid">
        {showLeads ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">Новые заявки</p>
              <h2>Кому нужен контакт прямо сейчас</h2>
              <p>
                Первая реакция в мебельном бизнесе критична: клиент ещё горячий,
                у него уже есть задача по кухне или шкафу, и здесь важна не
                абстрактная аналитика, а быстрый ответ менеджера.
              </p>
            </div>

            <div className="workboard-stack">
              {data.urgentLeads.map((item) => (
                <LeadEntry
                  item={item}
                  key={`${item.lead}-${item.deadline}`}
                  note={item.source}
                />
              ))}
            </div>
          </article>
        ) : null}

        {showTasks ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">Расчёт</p>
              <h2>Что нужно посчитать и дожать</h2>
              <p>
                Здесь лежат задачи, которые продвигают сделку вперёд: собрать
                расчёт стоимости, уточнить материалы, согласовать решение и
                быстро вернуться к клиенту.
              </p>
            </div>

            <div className="workboard-stack">
              {data.taskQueue.map((item) => (
                <article className="work-item" key={`${item.title}-${item.deadline}`}>
                  <div>
                    <strong>
                      <Link className="work-item-link" href={getTaskHref(item)}>
                        {item.title}
                      </Link>
                    </strong>
                    <p>{item.tag}</p>
                    <TaskCompleteButton title={item.title} />
                  </div>
                  <div className="work-meta">
                    <span>{item.owner}</span>
                    <strong>{item.deadline}</strong>
                    <em>{item.lane}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showMeasurements ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">Замеры</p>
              <h2>Ближайшие выезды и консультации</h2>
              <p>
                Мебельная сделка часто ломается не на первом сообщении, а на
                плохой координации выезда. Здесь всё, что должно быть
                подтверждено и доведено до факта встречи.
              </p>
            </div>

            <div className="workboard-stack">
              {upcomingMeasurements.map((item) => (
                <article className="work-item" key={item.id}>
                  <div>
                    <strong>
                      {getLeadAppointmentHref(item) ? (
                        <Link className="work-item-link" href={getLeadAppointmentHref(item)}>
                          {item.lead}
                        </Link>
                      ) : (
                        item.lead
                      )}
                    </strong>
                    <p>{item.note}</p>
                  </div>
                  <div className="work-meta">
                    <span>{formatAppointmentType(item.type)}</span>
                    <strong>{item.scheduledAt}</strong>
                    <em>{formatAppointmentStatus(item.status)}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showFollowups ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">Повторный контакт</p>
              <h2>Кого нельзя забыть после расчёта или замера</h2>
              <p>
                Самые дорогие потери часто случаются именно здесь: расчёт ушёл,
                замер прошёл, клиент тёплый, а команда просто не вернулась
                вовремя.
              </p>
            </div>

            <div className="workboard-stack">
              {data.followups.map((item) => (
                <article className="work-item" key={`${item.lead}-${item.scheduledAt}`}>
                  <div>
                    <strong>
                      {getLeadFollowupHref(item) ? (
                        <Link className="work-item-link" href={getLeadFollowupHref(item)}>
                          {item.lead}
                        </Link>
                      ) : (
                        item.lead
                      )}
                    </strong>
                    <p>{item.note}</p>
                    <FollowupCompleteButton
                      lead={item.lead}
                      scheduledAt={item.scheduledAt}
                      type={item.type}
                    />
                  </div>
                  <div className="work-meta">
                    <span>{item.owner}</span>
                    <strong>{item.scheduledAt}</strong>
                    <em>{item.type}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showAlerts ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">Риски</p>
              <h2>Сигналы, где нельзя ослаблять контроль</h2>
              <p>
                Это короткий список точек, где сделка может остыть: лид без
                ответа, КП без возврата, замер без подтверждения или клиент с
                паузой после предложения.
              </p>
            </div>

            <div className="workboard-stack">
              {data.alerts.map((item) => (
                <article className="work-item" key={`${item.time}-${item.action}`}>
                  <div>
                    <strong>
                      {getLeadAlertHref(item) ? (
                        <Link className="work-item-link" href={getLeadAlertHref(item)}>
                          {item.action}
                        </Link>
                      ) : (
                        item.action
                      )}
                    </strong>
                    <p>{item.detail}</p>
                  </div>
                  <div className="work-meta">
                    <span>{item.actor}</span>
                    <strong>
                      {getLeadAlertHref(item) ? (
                        <Link className="work-item-link" href={getLeadAlertHref(item)}>
                          {item.lead}
                        </Link>
                      ) : (
                        item.lead
                      )}
                    </strong>
                    <em>{item.time}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
