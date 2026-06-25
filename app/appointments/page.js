import Link from "next/link";
import AppointmentCreateForm from "../../components/appointment-create-form";
import AppointmentReminderButton from "../../components/appointment-reminder-button";
import AppointmentStatusForm from "../../components/appointment-status-form";
import AppointmentTemplateButton from "../../components/appointment-template-button";
import FilterBar from "../../components/filter-bar";
import { getLeadAppointmentHref } from "../../lib/lead-links";
import { safeLocalizedText, translateDurationText, translateLocationText, translateScheduleText } from "../../lib/display-text";
import { getLocale, pick } from "../../lib/i18n";
import { getLanguage } from "../../lib/i18n-server";
import { getAppointmentsData } from "../../lib/server-data";

export const metadata = {
  title: "Appointments | BOSE"
};

function formatAppointmentType(type, lang) {
  switch (type) {
    case "measurement":
      return pick(lang, "Measurement", "Замер");
    case "showroom":
      return pick(lang, "Showroom", "Шоурум");
    case "consultation":
      return pick(lang, "Consultation", "Консультация");
    case "call":
      return pick(lang, "Call", "Созвон");
    default:
      return type || pick(lang, "Meeting", "Встреча");
  }
}

function formatAppointmentStatus(status, lang) {
  switch (status) {
    case "SCHEDULED":
      return pick(lang, "Scheduled", "Назначено");
    case "CONFIRMED":
      return pick(lang, "Confirmed", "Подтверждено");
    case "COMPLETED":
      return pick(lang, "Completed", "Проведено");
    case "CANCELLED":
      return pick(lang, "Cancelled", "Отменено");
    case "NO_SHOW":
      return pick(lang, "No-show", "Не состоялось");
    default:
      return status;
  }
}

function MetricCard({ label, value, note, href }) {
  const content = (
    <>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </>
  );

  return href ? (
    <Link className="focus-card focus-card-link" href={href}>
      {content}
    </Link>
  ) : (
    <article className="focus-card">{content}</article>
  );
}

function AppointmentCard({ item, lang }) {
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
          {formatAppointmentStatus(item.status, lang)}
        </span>
      </div>

      <div className="followup-meta">
        <span>{item.measurer || item.owner}</span>
        <span>{formatAppointmentType(item.type, lang)}</span>
        <strong>{translateScheduleText(item.scheduledAt, lang, "Not scheduled", "Не назначено")}</strong>
      </div>

      <div className="followup-meta">
        <span>{translateDurationText(item.duration, lang, item.duration, item.duration)}</span>
        <span>{translateLocationText(item.address || item.location, lang)}</span>
      </div>

      {item.measurementResult || item.prepaymentAmount ? (
        <div className="followup-meta">
          <span>
            {item.measurementResult
              ? safeLocalizedText(
                  item.measurementResult,
                  lang,
                  "Measurement result is saved in the deal card.",
                  "Результат замера сохранён в карточке сделки."
                )
              : pick(lang, "Result pending", "Итог пока не зафиксирован")}
          </span>
          <span>{item.prepaymentAmount || pick(lang, "No deposit yet", "Без предоплаты")}</span>
        </div>
      ) : null}

      <AppointmentStatusForm id={item.id} lang={lang} status={item.status} />

      {item.status === "SCHEDULED" ? (
        <AppointmentTemplateButton
          id={item.id}
          label={pick(lang, "Send confirmation", "Отправить подтверждение")}
          templateKey="booking-confirmation"
        />
      ) : null}

      {["SCHEDULED", "CONFIRMED"].includes(item.status) ? (
        <AppointmentTemplateButton
          id={item.id}
          label={pick(lang, "Offer reschedule", "Предложить перенос")}
          templateKey="reschedule"
        />
      ) : null}

      {["SCHEDULED", "CONFIRMED"].includes(item.status) ? (
        <AppointmentReminderButton id={item.id} lang={lang} />
      ) : null}

      {href ? (
        <Link className="ghost-link" href={href}>
          {pick(lang, "Open deal", "Открыть сделку")}
        </Link>
      ) : null}
    </article>
  );
}

function sortByDateAsc(items) {
  return [...items].sort((first, second) => {
    const firstDate = first.scheduledAtIso ? new Date(first.scheduledAtIso).getTime() : Number.MAX_SAFE_INTEGER;
    const secondDate = second.scheduledAtIso ? new Date(second.scheduledAtIso).getTime() : Number.MAX_SAFE_INTEGER;
    return firstDate - secondDate;
  });
}

export default async function AppointmentsPage({ searchParams }) {
  const lang = await getLanguage();
  const locale = getLocale(lang);
  const resolved = await searchParams;
  const statusFilter = resolved?.status || "all";
  const appointments = await getAppointmentsData();

  const filtered = appointments.filter((item) => (statusFilter === "all" ? true : item.status === statusFilter));
  const now = Date.now();
  const upcoming = sortByDateAsc(
    appointments.filter((item) =>
      item.scheduledAtIso
        ? new Date(item.scheduledAtIso).getTime() >= now && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(item.status)
        : false
    )
  );
  const toConfirm = sortByDateAsc(appointments.filter((item) => item.status === "SCHEDULED"));
  const confirmed = appointments.filter((item) => item.status === "CONFIRMED");
  const revenue = appointments.reduce((sum, item) => sum + Number(item.revenueAmount || 0), 0);

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{pick(lang, "Appointments", "Замеры")}</p>
        <h1>{pick(lang, "Measurements, visits and consultations", "Замеры, выезды и консультации")}</h1>
        <p>
          {pick(
            lang,
            "Use one board for booking, confirmation, visit result and follow-up after the meeting.",
            "Один экран для записи, подтверждения, результата выезда и возврата после встречи."
          )}
        </p>
      </section>

      <FilterBar
        title={pick(lang, "Appointment status", "Статус замера")}
        paramKey="status"
        options={[
          { value: "all", label: pick(lang, "All", "Все") },
          { value: "SCHEDULED", label: pick(lang, "Scheduled", "Назначено") },
          { value: "CONFIRMED", label: pick(lang, "Confirmed", "Подтверждено") },
          { value: "COMPLETED", label: pick(lang, "Completed", "Проведено") },
          { value: "NO_SHOW", label: pick(lang, "No-show", "Не состоялось") }
        ]}
      />

      <section className="focus-grid">
        <MetricCard
          label={pick(lang, "Upcoming", "Ближайшие")}
          value={String(upcoming.length)}
          note={pick(lang, "Scheduled measurements and visits ahead.", "Назначенные замеры и выезды впереди.")}
        />
        <MetricCard
          label={pick(lang, "To confirm", "Ждут подтверждения")}
          value={String(toConfirm.length)}
          note={pick(lang, "Slots that still need a final confirmation.", "Слоты, которые ещё нужно подтвердить.")}
        />
        <MetricCard
          label={pick(lang, "Confirmed", "Подтверждено")}
          value={String(confirmed.length)}
          note={pick(lang, "Visits already locked in the calendar.", "Выезды, уже закреплённые в календаре.")}
        />
        <MetricCard
          label={pick(lang, "Visit revenue", "Выручка по визитам")}
          value={`${new Intl.NumberFormat(locale).format(revenue)} ₸`}
          note={pick(lang, "Money already fixed after appointments.", "Суммы, уже зафиксированные после выездов.")}
        />
      </section>

      <section className="lead-workflow-row">
        <AppointmentCreateForm
          lang={lang}
          title={pick(lang, "Book a measurement or consultation", "Назначить замер или консультацию")}
          description={pick(
            lang,
            "Create the next meeting directly in the system, with time, owner, format and notes for the team.",
            "Зафиксируй следующую встречу прямо в системе: время, формат, ответственного и комментарии для команды."
          )}
        />
      </section>

      <section className="followup-list">
        {filtered.map((item) => (
          <AppointmentCard key={item.id} item={item} lang={lang} />
        ))}
      </section>
    </main>
  );
}
