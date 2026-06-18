import Link from "next/link";
import FilterBar from "../../components/filter-bar";
import FollowupCompleteButton from "../../components/followup-complete-button";
import PilotRequestStatusForm from "../../components/pilot-request-status-form";
import TaskCompleteButton from "../../components/task-complete-button";
import {
  getLeadAlertHref,
  getLeadAppointmentHref,
  getLeadFollowupHref,
  getLeadStatusHref,
  getLeadTaskHref
} from "../../lib/lead-links";
import {
  safeLocalizedText,
  translateAlertAction,
  translateActorText,
  translateFollowupType,
  translateLocationText,
  translateScheduleText,
  translateSource,
  translateTaskLane,
  translateTaskTag,
  translateTaskTitle
} from "../../lib/display-text";
import {
  getAppointmentsData,
  getFollowupsData,
  getLeadsData,
  getWorkboardData
} from "../../lib/server-data";
import { pick } from "../../lib/i18n";
import { getLanguage } from "../../lib/i18n-server";

export const metadata = {
  title: "Workboard | Furneq"
};

function FocusCard({ label, value, note, href }) {
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

function formatLeadStatus(status, lang) {
  switch (status) {
    case "NEW":
      return pick(lang, "New lead", "Новая заявка");
    case "CONTACTED":
      return pick(lang, "Contact", "Связаться");
    case "QUALIFIED":
      return pick(lang, "Estimate", "Расчёт");
    case "MEETING":
      return pick(lang, "Measurement", "Замер");
    case "PROPOSAL":
      return pick(lang, "Approval", "Согласование");
    case "WON":
      return pick(lang, "Deposit", "Предоплата");
    case "LOST":
      return pick(lang, "Lost", "Отказ");
    default:
      return status || pick(lang, "Deal", "Сделка");
  }
}

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

function formatPilotRequestStatus(status, lang) {
  switch (status) {
    case "NEW":
      return pick(lang, "New", "Новая");
    case "CONTACTED":
      return pick(lang, "Contacted", "Связались");
    case "DEMO_BOOKED":
      return pick(lang, "Demo booked", "Демо назначено");
    case "PILOT_ACTIVE":
      return pick(lang, "Pilot active", "Пилот запущен");
    case "WON":
      return pick(lang, "Won", "Продано");
    case "LOST":
      return pick(lang, "Lost", "Потеряно");
    default:
      return status || pick(lang, "Pilot", "Пилот");
  }
}

function getPilotStatusClassName(status) {
  switch (String(status || "").toUpperCase()) {
    case "NEW":
      return "status-chip status-chip-new";
    case "CONTACTED":
      return "status-chip status-chip-contacted";
    case "DEMO_BOOKED":
      return "status-chip status-chip-demo_booked";
    case "PILOT_ACTIVE":
      return "status-chip status-chip-pilot_active";
    case "WON":
      return "status-chip status-chip-won";
    case "LOST":
      return "status-chip status-chip-lost";
    default:
      return "status-chip";
  }
}

function LeadEntry({ item, note, lang }) {
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
        <p>{translateSource(note, lang)}</p>
      </div>
      <div className="work-meta">
        <span>{item.owner}</span>
        <strong>
          {translateScheduleText(
            item.deadline || item.scheduledAt,
            lang,
            "Not scheduled",
            "Не назначено"
          )}
        </strong>
        <em>{item.status ? formatLeadStatus(item.status, lang) : item.type}</em>
      </div>
    </article>
  );
}

function PilotRequestEntry({ item, lang }) {
  const metaLine =
    [item.city, item.teamSize].filter(Boolean).join(" • ") ||
    pick(lang, "Pilot launch request", "Заявка на запуск пилота");
  const contactLine =
    [item.contactName, item.phone].filter(Boolean).join(" • ") ||
    pick(lang, "Contact details are missing.", "Контакт ещё не указан.");

  return (
    <article className="work-item">
      <div>
        <strong>{item.workshopName || item.requestNumber}</strong>
        <p>
          {safeLocalizedText(
            item.note,
            lang,
            "Open the pilot inbox and review the workshop pain point.",
            "Откройте pilot inbox и посмотрите, с какой болью пришёл цех."
          )}
        </p>
        {item.internalNote ? (
          <p className="pilot-internal-note">
            {pick(lang, "Internal note", "Внутренняя заметка")}: {item.internalNote}
          </p>
        ) : null}
        <PilotRequestStatusForm
          currentNote={item.internalNote || ""}
          currentStatus={item.status || "NEW"}
          lang={lang}
          requestId={item.id || item.requestNumber}
        />
      </div>
      <div className="work-meta">
        <span>{item.requestNumber}</span>
        <strong>{translateScheduleText(item.createdAt, lang, "Just now", "Только что")}</strong>
        <em className={getPilotStatusClassName(item.status)}>
          {formatPilotRequestStatus(item.status, lang)}
        </em>
        <em>{metaLine}</em>
        <em>{contactLine}</em>
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

  if (text.includes("замер") || text.includes("measurement")) {
    return "/appointments?status=SCHEDULED";
  }

  if (
    text.includes("кп") ||
    text.includes("расч") ||
    text.includes("смет") ||
    text.includes("estimate")
  ) {
    return "/leads?status=QUALIFIED";
  }

  if (text.includes("дожим") || text.includes("follow")) {
    return "/leads?status=PROPOSAL";
  }

  return "/workboard?view=estimates";
}

function formatTaskTagText(value, lang) {
  const source = String(value || "").trim().toLowerCase();

  if (lang === "en") {
    if (source.includes("первый контакт")) return "First contact";
    if (source.includes("расч")) return "Estimate";
    if (source.includes("сроч")) return "Urgent";
    if (source.includes("офис")) return "Office";
    if (source.includes("кп")) return "Quote";
    if (source.includes("смет")) return "Estimate";
    if (source.includes("замер")) return "Measurement";
  }

  return translateTaskTag(value, lang);
}

export default async function WorkboardPage({ searchParams }) {
  const lang = await getLanguage();
  const resolved = await searchParams;
  const view = resolved?.view || "all";

  const [data, leads, followups, appointments] = await Promise.all([
    getWorkboardData(),
    getLeadsData(),
    getFollowupsData(),
    getAppointmentsData()
  ]);

  const pilotInbox = Array.isArray(data.pilotInbox) ? data.pilotInbox : [];

  const focus = [
    {
      label: pick(lang, "No first reply", "Без первого ответа"),
      value: String(leads.filter((lead) => lead.status === "NEW").length),
      note: pick(
        lang,
        "New incoming leads that still need the first touch.",
        "Новые заявки, которым ещё нужен первый контакт."
      )
    },
    {
      label: pick(lang, "Waiting for estimate", "На расчёте"),
      value: String(
        leads.filter((lead) =>
          ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(lead.status)
        ).length
      ),
      note: pick(
        lang,
        "Deals that now need pricing, estimate or quote follow-up.",
        "Сделки, где сейчас нужен расчёт, смета или возврат по КП."
      )
    },
    {
      label: pick(lang, "Measurements and visits", "Замеры и встречи"),
      value: String(
        appointments.filter((item) => ["SCHEDULED", "CONFIRMED"].includes(item.status))
          .length
      ),
      note: pick(
        lang,
        "Upcoming site visits, showroom meetings and consultations.",
        "Ближайшие выезды, шоурум и консультации."
      )
    },
    {
      label: pick(lang, "Follow-ups", "Повторный контакт"),
      value: String(followups.filter((item) => item.status === "PENDING").length),
      note: pick(
        lang,
        "Warm clients that should not be left without a callback.",
        "Тёплые клиенты, которых нельзя оставить без возврата."
      )
    },
    {
      label: pick(lang, "Pilot launches", "Запуски пилота"),
      value: String(pilotInbox.length),
      note: pick(
        lang,
        "Workshop owners who asked to launch Furneq for their team.",
        "Владельцы цехов, которые уже запросили запуск Furneq под свой процесс."
      )
    }
  ];

  const linkedFocus = focus.map((item, index) => ({
    ...item,
    href:
      [
        "/leads?status=NEW",
        "/workboard?view=estimates",
        "/appointments",
        "/workboard?view=followups",
        "/workboard?view=pilots"
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
  const showPilots = view === "all" || view === "pilots";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{pick(lang, "Workboard", "Смена")}</p>
        <h1>{pick(lang, "One queue for the whole team", "Одна рабочая очередь для всей команды")}</h1>
        <p>
          {pick(
            lang,
            "Use one board for new leads, estimate work, upcoming visits, follow-ups and risk signals.",
            "Один экран для новых заявок, расчётов, замеров, возвратов и сигналов риска."
          )}
        </p>
      </section>

      <section className="panel">
        <FilterBar
          title={pick(lang, "Show", "Показать")}
          paramKey="view"
          options={[
            { value: "all", label: pick(lang, "All", "Всё") },
            { value: "intake", label: pick(lang, "New leads", "Новые заявки") },
            { value: "estimates", label: pick(lang, "Estimate", "Расчёт") },
            { value: "measurements", label: pick(lang, "Appointments", "Замеры") },
            { value: "followups", label: pick(lang, "Follow-ups", "Возвраты") },
            { value: "alerts", label: pick(lang, "Risks", "Риски") },
            { value: "pilots", label: pick(lang, "Pilots", "Пилоты") }
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
              <p className="eyebrow">{pick(lang, "New leads", "Новые заявки")}</p>
              <h2>{pick(lang, "Who needs the first contact now", "Кому нужен первый контакт прямо сейчас")}</h2>
            </div>
            <div className="workboard-stack">
              {data.urgentLeads.map((item) => (
                <LeadEntry
                  item={item}
                  key={`${item.lead}-${item.deadline}`}
                  lang={lang}
                  note={item.source}
                />
              ))}
            </div>
          </article>
        ) : null}

        {showPilots ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Pilots", "Пилоты")}</p>
              <h2>{pick(lang, "Who wants Furneq for their workshop", "Кто хочет внедрить Furneq в свой цех")}</h2>
            </div>
            <div className="workboard-stack">
              {pilotInbox.length ? (
                pilotInbox.map((item) => (
                  <PilotRequestEntry
                    item={item}
                    key={item.id || item.requestNumber}
                    lang={lang}
                  />
                ))
              ) : (
                <article className="work-item">
                  <div>
                    <strong>{pick(lang, "No pilot requests yet", "Пока нет заявок на пилот")}</strong>
                    <p>
                      {pick(
                        lang,
                        "Use the landing CTA and the bot pilot flow to collect the first workshop launch requests.",
                        "Используйте CTA на landing и pilot flow в боте, чтобы собрать первые заявки на запуск от мебельных цехов."
                      )}
                    </p>
                  </div>
                </article>
              )}
            </div>
          </article>
        ) : null}

        {showTasks ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Estimate", "Расчёт")}</p>
              <h2>{pick(lang, "Pricing and quote tasks", "Задачи по расчёту и КП")}</h2>
            </div>
            <div className="workboard-stack">
              {data.taskQueue.map((item) => (
                <article className="work-item" key={`${item.title}-${item.deadline}`}>
                  <div>
                    <strong>
                      <Link className="work-item-link" href={getTaskHref(item)}>
                        {translateTaskTitle(item.title, lang)}
                      </Link>
                    </strong>
                    <p>{formatTaskTagText(item.tag, lang)}</p>
                    <TaskCompleteButton lang={lang} title={item.title} />
                  </div>
                  <div className="work-meta">
                    <span>{item.owner}</span>
                    <strong>
                      {translateScheduleText(item.deadline, lang, "Not scheduled", "Не назначено")}
                    </strong>
                    <em>{translateTaskLane(item.lane, lang)}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showMeasurements ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Appointments", "Замеры")}</p>
              <h2>{pick(lang, "Upcoming visits", "Ближайшие выезды")}</h2>
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
                    <p>{translateLocationText(item.address || item.location, lang)}</p>
                  </div>
                  <div className="work-meta">
                    <span>{formatAppointmentType(item.type, lang)}</span>
                    <strong>
                      {translateScheduleText(item.scheduledAt, lang, "Not scheduled", "Не назначено")}
                    </strong>
                    <em>{formatAppointmentStatus(item.status, lang)}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showFollowups ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Follow-ups", "Возвраты")}</p>
              <h2>{pick(lang, "Who needs a callback", "Кого нужно вернуть в контакт")}</h2>
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
                    <p>
                      {safeLocalizedText(
                        item.note,
                        lang,
                        "Open the deal card to review the follow-up details.",
                        "Откройте сделку, чтобы посмотреть детали возврата."
                      )}
                    </p>
                    <FollowupCompleteButton
                      lang={lang}
                      lead={item.lead}
                      scheduledAt={item.scheduledAt}
                      type={item.type}
                    />
                  </div>
                  <div className="work-meta">
                    <span>{item.owner}</span>
                    <strong>
                      {translateScheduleText(item.scheduledAt, lang, "Not scheduled", "Не назначено")}
                    </strong>
                    <em>{translateFollowupType(item.type, lang)}</em>
                  </div>
                </article>
              ))}
            </div>
          </article>
        ) : null}

        {showAlerts ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Risks", "Риски")}</p>
              <h2>{pick(lang, "Signals that need attention", "Сигналы, где нужен контроль")}</h2>
            </div>
            <div className="workboard-stack">
              {data.alerts.map((item) => (
                <article className="work-item" key={`${item.time}-${item.action}`}>
                  <div>
                    <strong>
                      {getLeadAlertHref(item) ? (
                        <Link className="work-item-link" href={getLeadAlertHref(item)}>
                          {translateAlertAction(item.action, lang)}
                        </Link>
                      ) : (
                        translateAlertAction(item.action, lang)
                      )}
                    </strong>
                    <p>
                      {safeLocalizedText(
                        item.detail,
                        lang,
                        "Open the deal card to review the latest signal.",
                        "Откройте сделку, чтобы посмотреть подробности сигнала."
                      )}
                    </p>
                  </div>
                  <div className="work-meta">
                    <span>{translateActorText(item.actor, lang)}</span>
                    <strong>
                      {getLeadAlertHref(item) ? (
                        <Link className="work-item-link" href={getLeadAlertHref(item)}>
                          {item.lead}
                        </Link>
                      ) : (
                        item.lead
                      )}
                    </strong>
                    <em>{translateScheduleText(item.time, lang, item.time, item.time)}</em>
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
