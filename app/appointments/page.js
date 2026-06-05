import Link from "next/link";
import AppointmentCreateForm from "../../components/appointment-create-form";
import AppointmentReminderButton from "../../components/appointment-reminder-button";
import AppointmentStatusForm from "../../components/appointment-status-form";
import AppointmentTemplateButton from "../../components/appointment-template-button";
import FilterBar from "../../components/filter-bar";
import { getLeadAppointmentHref } from "../../lib/lead-links";
import { getAppointmentsData } from "../../lib/server-data";

export const metadata = {
  title: "Замеры | Mebel RDN CRM"
};

function MetricCard({ label, value, note, href }) {
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

function AppointmentCard({ item }) {
  const href = getLeadAppointmentHref(item);

  return (
    <article className="followup-card">
      <div className="followup-card-head">
        <h2>
          {href ? (
            <Link className="work-item-link" href={href}>
              {item.lead}
            </Link>
          ) : (
            item.lead
          )}
        </h2>
        <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
          {item.measurementStatus || formatAppointmentStatus(item.status)}
        </span>
      </div>

      <p>{item.measurementComment || item.note}</p>

      <div className="followup-meta">
        <span>{item.measurer || item.owner}</span>
        <span>{formatAppointmentType(item.type)}</span>
        <strong>{item.scheduledAt}</strong>
      </div>

      <div className="followup-meta">
        <span>{item.duration}</span>
        <span>{item.address || item.location}</span>
      </div>

      {item.measurementResult || item.outcomeNote || item.prepaymentAmount ? (
        <div className="followup-meta">
          <span>{item.measurementResult || item.outcomeNote || "Итог замера пока не зафиксирован"}</span>
          <span>{item.prepaymentAmount || (item.revenueAmount ? `${item.revenueAmount} ₸` : "Без предоплаты")}</span>
        </div>
      ) : null}

      <AppointmentStatusForm id={item.id} status={item.status} />

      {item.status === "SCHEDULED" ? (
        <AppointmentTemplateButton
          id={item.id}
          label="Отправить подтверждение"
          templateKey="booking-confirmation"
        />
      ) : null}

      {["SCHEDULED", "CONFIRMED"].includes(item.status) ? (
        <AppointmentTemplateButton
          id={item.id}
          label="Предложить перенос"
          templateKey="reschedule"
        />
      ) : null}

      {["SCHEDULED", "CONFIRMED"].includes(item.status) ? (
        <AppointmentReminderButton id={item.id} />
      ) : null}

      {href ? (
        <Link className="ghost-link" href={href}>
          Открыть сделку
        </Link>
      ) : null}
    </article>
  );
}

function sortByDateAsc(items) {
  return [...items].sort((first, second) => {
    const firstDate = first.scheduledAtIso
      ? new Date(first.scheduledAtIso).getTime()
      : Number.MAX_SAFE_INTEGER;
    const secondDate = second.scheduledAtIso
      ? new Date(second.scheduledAtIso).getTime()
      : Number.MAX_SAFE_INTEGER;
    return firstDate - secondDate;
  });
}

export default async function AppointmentsPage({ searchParams }) {
  const resolved = await searchParams;
  const statusFilter = resolved?.status || "all";
  const appointments = await getAppointmentsData();

  const filtered = appointments.filter((item) =>
    statusFilter === "all" ? true : item.status === statusFilter
  );

  const now = Date.now();
  const upcoming = sortByDateAsc(
    appointments.filter((item) =>
      item.scheduledAtIso
        ? new Date(item.scheduledAtIso).getTime() >= now &&
          !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status)
        : false
    )
  );
  const toConfirm = sortByDateAsc(
    appointments.filter((item) => item.status === "SCHEDULED")
  );
  const confirmed = appointments.filter((item) => item.status === "CONFIRMED");
  const noShow = appointments.filter((item) => item.status === "NO_SHOW");
  const revenue = appointments.reduce(
    (sum, item) => sum + Number(item.revenueAmount || 0),
    0
  );

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Замеры</p>
        <h1>Замеры, выезды и консультации под контролем</h1>
        <p>
          Для мебельного бизнеса замер и встреча с клиентом — это не мелкий
          вспомогательный этап, а точка, где сделка либо ускоряется, либо
          рассыпается. Здесь весь контур подтверждений и итогов собран в одном
          месте.
        </p>
      </section>

      <FilterBar
        title="Статус замера / выезда"
        paramKey="status"
        options={[
          { value: "all", label: "Все" },
          { value: "SCHEDULED", label: "Назначено" },
          { value: "CONFIRMED", label: "Подтверждено" },
          { value: "COMPLETED", label: "Проведено" },
          { value: "NO_SHOW", label: "Не состоялось" }
        ]}
      />

      <section className="focus-grid">
        <MetricCard
          label="Ближайшие замеры"
          value={String(upcoming.length)}
          note="Все замеры, шоурум и консультации, где команда уже близко к следующему шагу."
        />
        <MetricCard
          label="Ждут подтверждения"
          value={String(toConfirm.length)}
          note="Слоты, по которым клиенту ещё нужно напомнить или подтвердить адрес."
        />
        <MetricCard
          label="Подтверждено"
          value={String(confirmed.length)}
          note="Выезды и встречи, которые уже закреплены в календаре."
        />
        <MetricCard
          label="Проведено на сумму"
          value={`${new Intl.NumberFormat("ru-RU").format(revenue)} ₸`}
          note="Предоплата и суммы, которые уже зафиксированы после выезда."
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">Подтверждение</p>
            <h2>Что нужно дожать до факта выезда</h2>
            <p>
              Это список слотов, где менеджеру важно не забыть про адрес,
              подтверждение времени, шоурум или напоминание перед выездом.
            </p>
          </div>

          <div className="workboard-stack">
            {toConfirm.length ? (
              toConfirm.map((item) => (
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
              ))
            ) : (
              <article className="timeline-empty">
                Сейчас нет замеров и выездов, которым не хватает подтверждения.
              </article>
            )}
          </div>
        </div>

        <div className="panel workboard-panel">
          <div className="section-title">
            <p className="eyebrow">Срывы</p>
            <h2>Где нужна быстрая реакция после неявки</h2>
            <p>
              Если клиент не доехал до встречи, его важно быстро вернуть в
              контакт, пока интерес ещё живой и сделка не ушла в тишину.
            </p>
          </div>

          <div className="workboard-stack">
            {noShow.length ? (
              noShow.map((item) => (
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
                    <p>{item.outcomeNote || item.note}</p>
                  </div>
                  <div className="work-meta">
                    <span>{item.owner}</span>
                    <strong>{item.scheduledAt}</strong>
                    <em>{formatAppointmentStatus(item.status)}</em>
                  </div>
                </article>
              ))
            ) : (
              <article className="timeline-empty">
                Сейчас нет встреч, которые сорвались или требуют спасения.
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="lead-workflow-row">
        <AppointmentCreateForm
          title="Назначить замер или консультацию"
          description="Этот блок нужен, чтобы менеджер быстро фиксировал замер, выезд в шоурум или консультацию прямо в системе, а не в хаотичных переписках."
        />
      </section>

      <section className="followup-list">
        {filtered.map((item) => (
          <AppointmentCard key={item.id} item={item} />
        ))}
      </section>
    </main>
  );
}
