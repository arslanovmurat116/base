import Link from "next/link";
import FilterBar from "../../components/filter-bar";
import FollowupCompleteButton from "../../components/followup-complete-button";
import PilotRequestStatusForm from "../../components/pilot-request-status-form";
import ProductLaunchStatusForm from "../../components/product-launch-status-form";
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
      return pick(lang, "New lead", "РќРѕРІР°СЏ Р·Р°СЏРІРєР°");
    case "CONTACTED":
      return pick(lang, "Contact", "РЎРІСЏР·Р°С‚СЊСЃСЏ");
    case "QUALIFIED":
      return pick(lang, "Estimate", "Р Р°СЃС‡С‘С‚");
    case "MEETING":
      return pick(lang, "Measurement", "Р—Р°РјРµСЂ");
    case "PROPOSAL":
      return pick(lang, "Approval", "РЎРѕРіР»Р°СЃРѕРІР°РЅРёРµ");
    case "WON":
      return pick(lang, "Deposit", "РџСЂРµРґРѕРїР»Р°С‚Р°");
    case "LOST":
      return pick(lang, "Lost", "РћС‚РєР°Р·");
    default:
      return status || pick(lang, "Deal", "РЎРґРµР»РєР°");
  }
}

function formatAppointmentType(type, lang) {
  switch (type) {
    case "measurement":
      return pick(lang, "Measurement", "Р—Р°РјРµСЂ");
    case "showroom":
      return pick(lang, "Showroom", "РЁРѕСѓСЂСѓРј");
    case "consultation":
      return pick(lang, "Consultation", "РљРѕРЅСЃСѓР»СЊС‚Р°С†РёСЏ");
    case "call":
      return pick(lang, "Call", "РЎРѕР·РІРѕРЅ");
    default:
      return type || pick(lang, "Meeting", "Р’СЃС‚СЂРµС‡Р°");
  }
}

function formatAppointmentStatus(status, lang) {
  switch (status) {
    case "SCHEDULED":
      return pick(lang, "Scheduled", "РќР°Р·РЅР°С‡РµРЅРѕ");
    case "CONFIRMED":
      return pick(lang, "Confirmed", "РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ");
    case "COMPLETED":
      return pick(lang, "Completed", "РџСЂРѕРІРµРґРµРЅРѕ");
    case "CANCELLED":
      return pick(lang, "Cancelled", "РћС‚РјРµРЅРµРЅРѕ");
    case "NO_SHOW":
      return pick(lang, "No-show", "РќРµ СЃРѕСЃС‚РѕСЏР»РѕСЃСЊ");
    default:
      return status;
  }
}

function formatPilotRequestStatus(status, lang) {
  switch (status) {
    case "NEW":
      return pick(lang, "New", "РќРѕРІР°СЏ");
    case "CONTACTED":
      return pick(lang, "Contacted", "РЎРІСЏР·Р°Р»РёСЃСЊ");
    case "DEMO_BOOKED":
      return pick(lang, "Demo booked", "Р”РµРјРѕ РЅР°Р·РЅР°С‡РµРЅРѕ");
    case "PILOT_ACTIVE":
      return pick(lang, "Pilot active", "РџРёР»РѕС‚ Р·Р°РїСѓС‰РµРЅ");
    case "WON":
      return pick(lang, "Won", "РџСЂРѕРґР°РЅРѕ");
    case "LOST":
      return pick(lang, "Lost", "РџРѕС‚РµСЂСЏРЅРѕ");
    default:
      return status || pick(lang, "Pilot", "РџРёР»РѕС‚");
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

function formatProductLaunchStatus(status, lang) {
  switch (status) {
    case "KICKOFF_PENDING":
      return pick(lang, "Kickoff pending", "Р–РґС‘С‚ kickoff");
    case "ACCESS_SETUP":
      return pick(lang, "Access setup", "Р”РѕСЃС‚СѓРїС‹ Рё setup");
    case "TEAM_SETUP":
      return pick(lang, "Team setup", "РљРѕРјР°РЅРґР° Рё РґР°РЅРЅС‹Рµ");
    case "TRAINING":
      return pick(lang, "Training", "РћР±СѓС‡РµРЅРёРµ");
    case "LIVE":
      return pick(lang, "Live", "Р—Р°РїСѓС‰РµРЅРѕ");
    case "BLOCKED":
      return pick(lang, "Blocked", "Р•СЃС‚СЊ Р±Р»РѕРєРµСЂ");
    default:
      return status || pick(lang, "Launch", "Р—Р°РїСѓСЃРє");
  }
}

function getProductLaunchStatusClassName(status) {
  switch (String(status || "").toUpperCase()) {
    case "KICKOFF_PENDING":
      return "status-chip status-chip-demo_booked";
    case "ACCESS_SETUP":
      return "status-chip status-chip-contacted";
    case "TEAM_SETUP":
      return "status-chip status-chip-pilot_active";
    case "TRAINING":
      return "status-chip status-chip-qualified";
    case "LIVE":
      return "status-chip status-chip-won";
    case "BLOCKED":
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
            "РќРµ РЅР°Р·РЅР°С‡РµРЅРѕ"
          )}
        </strong>
        <em>{item.status ? formatLeadStatus(item.status, lang) : item.type}</em>
      </div>
    </article>
  );
}

function PilotRequestEntry({ item, lang }) {
  const metaLine =
    [item.city, item.teamSize].filter(Boolean).join(" вЂў ") ||
    pick(lang, "Pilot launch request", "Р—Р°СЏРІРєР° РЅР° Р·Р°РїСѓСЃРє РїРёР»РѕС‚Р°");
  const contactLine =
    [item.contactName, item.phone].filter(Boolean).join(" вЂў ") ||
    pick(lang, "Contact details are missing.", "РљРѕРЅС‚Р°РєС‚ РµС‰С‘ РЅРµ СѓРєР°Р·Р°РЅ.");

  return (
    <article className="work-item">
      <div>
        <strong>{item.workshopName || item.requestNumber}</strong>
        <p>
          {safeLocalizedText(
            item.note,
            lang,
            "Open the pilot inbox and review the workshop pain point.",
            "РћС‚РєСЂРѕР№С‚Рµ pilot inbox Рё РїРѕСЃРјРѕС‚СЂРёС‚Рµ, СЃ РєР°РєРѕР№ Р±РѕР»СЊСЋ РїСЂРёС€С‘Р» С†РµС…."
          )}
        </p>
        {item.internalNote ? (
          <p className="pilot-internal-note">
            {pick(lang, "Internal note", "Р’РЅСѓС‚СЂРµРЅРЅСЏСЏ Р·Р°РјРµС‚РєР°")}: {item.internalNote}
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
        <strong>{translateScheduleText(item.createdAt, lang, "Just now", "РўРѕР»СЊРєРѕ С‡С‚Рѕ")}</strong>
        <em className={getPilotStatusClassName(item.status)}>
          {formatPilotRequestStatus(item.status, lang)}
        </em>
        <em>{metaLine}</em>
        <em>{contactLine}</em>
      </div>
    </article>
  );
}

function ProductLaunchEntry({ item, lang }) {
  const metaLine =
    [item.city, item.teamSize].filter(Boolean).join(" вЂў ") ||
    pick(lang, "Customer launch", "Р—Р°РїСѓСЃРє РєР»РёРµРЅС‚Р°");
  const contactLine =
    [item.contactName, item.phone].filter(Boolean).join(" вЂў ") ||
    pick(lang, "Contact details are missing.", "РљРѕРЅС‚Р°РєС‚ РµС‰С‘ РЅРµ СѓРєР°Р·Р°РЅ.");

  return (
    <article className="work-item">
      <div>
        <strong>{item.workshopName || item.launchNumber}</strong>
        <p>
          {safeLocalizedText(
            item.note,
            lang,
            "Open the launch inbox and move the workshop through kickoff, setup and go-live.",
            "РћС‚РєСЂРѕР№С‚Рµ launch inbox Рё РїСЂРѕРІРµРґРёС‚Рµ С†РµС… С‡РµСЂРµР· kickoff, РЅР°СЃС‚СЂРѕР№РєСѓ Рё Р·Р°РїСѓСЃРє."
          )}
        </p>
        {item.handoffNote ? (
          <p className="pilot-internal-note">
            {pick(lang, "Handoff note", "Handoff-Р·Р°РјРµС‚РєР°")}: {item.handoffNote}
          </p>
        ) : null}
        <ProductLaunchStatusForm
          currentNote={item.handoffNote || ""}
          currentStatus={item.status || "KICKOFF_PENDING"}
          lang={lang}
          launchId={item.id || item.launchNumber}
        />
      </div>
      <div className="work-meta">
        <span>{item.launchNumber}</span>
        <strong>
          {translateScheduleText(item.updatedAt || item.createdAt, lang, "Just now", "РўРѕР»СЊРєРѕ С‡С‚Рѕ")}
        </strong>
        <em className={getProductLaunchStatusClassName(item.status)}>
          {formatProductLaunchStatus(item.status, lang)}
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

  if (text.includes("Р·Р°РјРµСЂ") || text.includes("measurement")) {
    return "/appointments?status=SCHEDULED";
  }

  if (
    text.includes("РєРї") ||
    text.includes("СЂР°СЃС‡") ||
    text.includes("СЃРјРµС‚") ||
    text.includes("estimate")
  ) {
    return "/leads?status=QUALIFIED";
  }

  if (text.includes("РґРѕР¶РёРј") || text.includes("follow")) {
    return "/leads?status=PROPOSAL";
  }

  return "/workboard?view=estimates";
}

function formatTaskTagText(value, lang) {
  const source = String(value || "").trim().toLowerCase();

  if (lang === "en") {
    if (source.includes("РїРµСЂРІС‹Р№ РєРѕРЅС‚Р°РєС‚")) return "First contact";
    if (source.includes("СЂР°СЃС‡")) return "Estimate";
    if (source.includes("СЃСЂРѕС‡")) return "Urgent";
    if (source.includes("РѕС„РёСЃ")) return "Office";
    if (source.includes("РєРї")) return "Quote";
    if (source.includes("СЃРјРµС‚")) return "Estimate";
    if (source.includes("Р·Р°РјРµСЂ")) return "Measurement";
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
  const launchInbox = Array.isArray(data.launchInbox) ? data.launchInbox : [];

  const focus = [
    {
      label: pick(lang, "No first reply", "Р‘РµР· РїРµСЂРІРѕРіРѕ РѕС‚РІРµС‚Р°"),
      value: String(leads.filter((lead) => lead.status === "NEW").length),
      note: pick(
        lang,
        "New incoming leads that still need the first touch.",
        "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё, РєРѕС‚РѕСЂС‹Рј РµС‰С‘ РЅСѓР¶РµРЅ РїРµСЂРІС‹Р№ РєРѕРЅС‚Р°РєС‚."
      )
    },
    {
      label: pick(lang, "Waiting for estimate", "РќР° СЂР°СЃС‡С‘С‚Рµ"),
      value: String(
        leads.filter((lead) =>
          ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(lead.status)
        ).length
      ),
      note: pick(
        lang,
        "Deals that now need pricing, estimate or quote follow-up.",
        "РЎРґРµР»РєРё, РіРґРµ СЃРµР№С‡Р°СЃ РЅСѓР¶РµРЅ СЂР°СЃС‡С‘С‚, СЃРјРµС‚Р° РёР»Рё РІРѕР·РІСЂР°С‚ РїРѕ РљРџ."
      )
    },
    {
      label: pick(lang, "Measurements and visits", "Р—Р°РјРµСЂС‹ Рё РІСЃС‚СЂРµС‡Рё"),
      value: String(
        appointments.filter((item) => ["SCHEDULED", "CONFIRMED"].includes(item.status))
          .length
      ),
      note: pick(
        lang,
        "Upcoming site visits, showroom meetings and consultations.",
        "Р‘Р»РёР¶Р°Р№С€РёРµ РІС‹РµР·РґС‹, С€РѕСѓСЂСѓРј Рё РєРѕРЅСЃСѓР»СЊС‚Р°С†РёРё."
      )
    },
    {
      label: pick(lang, "Follow-ups", "РџРѕРІС‚РѕСЂРЅС‹Р№ РєРѕРЅС‚Р°РєС‚"),
      value: String(followups.filter((item) => item.status === "PENDING").length),
      note: pick(
        lang,
        "Warm clients that should not be left without a callback.",
        "РўС‘РїР»С‹Рµ РєР»РёРµРЅС‚С‹, РєРѕС‚РѕСЂС‹С… РЅРµР»СЊР·СЏ РѕСЃС‚Р°РІРёС‚СЊ Р±РµР· РІРѕР·РІСЂР°С‚Р°."
      )
    },
    {
      label: pick(lang, "Pilot launches", "Р—Р°РїСѓСЃРєРё РїРёР»РѕС‚Р°"),
      value: String(pilotInbox.length),
      note: pick(
        lang,
        "Workshop owners who asked to launch Furneq for their team.",
        "Р’Р»Р°РґРµР»СЊС†С‹ С†РµС…РѕРІ, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ Р·Р°РїСЂРѕСЃРёР»Рё Р·Р°РїСѓСЃРє Furneq РїРѕРґ СЃРІРѕР№ РїСЂРѕС†РµСЃСЃ."
      )
    },
    {
      label: pick(lang, "Customer launches", "Р—Р°РїСѓСЃРєРё РєР»РёРµРЅС‚Р°"),
      value: String(launchInbox.length),
      note: pick(
        lang,
        "Sold pilots that should now move through kickoff, setup and go-live.",
        "РџСЂРѕРґР°РЅРЅС‹Рµ РїРёР»РѕС‚С‹, РєРѕС‚РѕСЂС‹Рµ СѓР¶Рµ РЅСѓР¶РЅРѕ РїСЂРѕРІРµСЃС‚Рё С‡РµСЂРµР· kickoff, РЅР°СЃС‚СЂРѕР№РєСѓ Рё Р·Р°РїСѓСЃРє."
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
        "/workboard?view=pilots",
        "/workboard?view=launches"
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
  const showLaunches = view === "all" || view === "launches";

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{pick(lang, "Workboard", "РЎРјРµРЅР°")}</p>
        <h1>{pick(lang, "One queue for the whole team", "РћРґРЅР° СЂР°Р±РѕС‡Р°СЏ РѕС‡РµСЂРµРґСЊ РґР»СЏ РІСЃРµР№ РєРѕРјР°РЅРґС‹")}</h1>
        <p>
          {pick(
            lang,
            "Use one board for new leads, estimate work, upcoming visits, follow-ups and risk signals.",
            "РћРґРёРЅ СЌРєСЂР°РЅ РґР»СЏ РЅРѕРІС‹С… Р·Р°СЏРІРѕРє, СЂР°СЃС‡С‘С‚РѕРІ, Р·Р°РјРµСЂРѕРІ, РІРѕР·РІСЂР°С‚РѕРІ Рё СЃРёРіРЅР°Р»РѕРІ СЂРёСЃРєР°."
          )}
        </p>
      </section>

      <section className="panel">
        <FilterBar
          title={pick(lang, "Show", "РџРѕРєР°Р·Р°С‚СЊ")}
          paramKey="view"
          options={[
            { value: "all", label: pick(lang, "All", "Р’СЃС‘") },
            { value: "intake", label: pick(lang, "New leads", "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё") },
            { value: "estimates", label: pick(lang, "Estimate", "Р Р°СЃС‡С‘С‚") },
            { value: "measurements", label: pick(lang, "Appointments", "Р—Р°РјРµСЂС‹") },
            { value: "followups", label: pick(lang, "Follow-ups", "Р’РѕР·РІСЂР°С‚С‹") },
            { value: "alerts", label: pick(lang, "Risks", "Р РёСЃРєРё") },
            { value: "pilots", label: pick(lang, "Pilots", "РџРёР»РѕС‚С‹") },
            { value: "launches", label: pick(lang, "Launches", "Запуски") }
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
              <p className="eyebrow">{pick(lang, "New leads", "РќРѕРІС‹Рµ Р·Р°СЏРІРєРё")}</p>
              <h2>{pick(lang, "Who needs the first contact now", "РљРѕРјСѓ РЅСѓР¶РµРЅ РїРµСЂРІС‹Р№ РєРѕРЅС‚Р°РєС‚ РїСЂСЏРјРѕ СЃРµР№С‡Р°СЃ")}</h2>
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
              <p className="eyebrow">{pick(lang, "Pilots", "РџРёР»РѕС‚С‹")}</p>
              <h2>{pick(lang, "Who wants Furneq for their workshop", "РљС‚Рѕ С…РѕС‡РµС‚ РІРЅРµРґСЂРёС‚СЊ Furneq РІ СЃРІРѕР№ С†РµС…")}</h2>
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
                    <strong>{pick(lang, "No pilot requests yet", "РџРѕРєР° РЅРµС‚ Р·Р°СЏРІРѕРє РЅР° РїРёР»РѕС‚")}</strong>
                    <p>
                      {pick(
                        lang,
                        "Use the landing CTA and the bot pilot flow to collect the first workshop launch requests.",
                        "РСЃРїРѕР»СЊР·СѓР№С‚Рµ CTA РЅР° landing Рё pilot flow РІ Р±РѕС‚Рµ, С‡С‚РѕР±С‹ СЃРѕР±СЂР°С‚СЊ РїРµСЂРІС‹Рµ Р·Р°СЏРІРєРё РЅР° Р·Р°РїСѓСЃРє РѕС‚ РјРµР±РµР»СЊРЅС‹С… С†РµС…РѕРІ."
                      )}
                    </p>
                  </div>
                </article>
              )}
            </div>
          </article>
        ) : null}
        {showLaunches ? (
          <article className="panel workboard-panel">
            <div className="section-title">
              <p className="eyebrow">{pick(lang, "Launches", "Запуски")}</p>
              <h2>{pick(lang, "Who is moving from sold pilot to live customer", "Кто уже переходит из продажи в живой запуск")}</h2>
            </div>
            <div className="workboard-stack">
              {launchInbox.length ? (
                launchInbox.map((item) => (
                  <ProductLaunchEntry
                    item={item}
                    key={item.id || item.launchNumber}
                    lang={lang}
                  />
                ))
              ) : (
                <article className="work-item">
                  <div>
                    <strong>{pick(lang, "No launches yet", "Пока нет запусков")}</strong>
                    <p>
                      {pick(
                        lang,
                        "As soon as a pilot request is marked as won, Furneq will create a launch handoff here.",
                        "Как только pilot request переводится в sold, Furneq создаёт здесь handoff на запуск."
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
              <p className="eyebrow">{pick(lang, "Estimate", "Р Р°СЃС‡С‘С‚")}</p>
              <h2>{pick(lang, "Pricing and quote tasks", "Р—Р°РґР°С‡Рё РїРѕ СЂР°СЃС‡С‘С‚Сѓ Рё РљРџ")}</h2>
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
                      {translateScheduleText(item.deadline, lang, "Not scheduled", "РќРµ РЅР°Р·РЅР°С‡РµРЅРѕ")}
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
              <p className="eyebrow">{pick(lang, "Appointments", "Р—Р°РјРµСЂС‹")}</p>
              <h2>{pick(lang, "Upcoming visits", "Р‘Р»РёР¶Р°Р№С€РёРµ РІС‹РµР·РґС‹")}</h2>
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
                      {translateScheduleText(item.scheduledAt, lang, "Not scheduled", "РќРµ РЅР°Р·РЅР°С‡РµРЅРѕ")}
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
              <p className="eyebrow">{pick(lang, "Follow-ups", "Р’РѕР·РІСЂР°С‚С‹")}</p>
              <h2>{pick(lang, "Who needs a callback", "РљРѕРіРѕ РЅСѓР¶РЅРѕ РІРµСЂРЅСѓС‚СЊ РІ РєРѕРЅС‚Р°РєС‚")}</h2>
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
                        "РћС‚РєСЂРѕР№С‚Рµ СЃРґРµР»РєСѓ, С‡С‚РѕР±С‹ РїРѕСЃРјРѕС‚СЂРµС‚СЊ РґРµС‚Р°Р»Рё РІРѕР·РІСЂР°С‚Р°."
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
                      {translateScheduleText(item.scheduledAt, lang, "Not scheduled", "РќРµ РЅР°Р·РЅР°С‡РµРЅРѕ")}
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
              <p className="eyebrow">{pick(lang, "Risks", "Р РёСЃРєРё")}</p>
              <h2>{pick(lang, "Signals that need attention", "РЎРёРіРЅР°Р»С‹, РіРґРµ РЅСѓР¶РµРЅ РєРѕРЅС‚СЂРѕР»СЊ")}</h2>
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
                        "РћС‚РєСЂРѕР№С‚Рµ СЃРґРµР»РєСѓ, С‡С‚РѕР±С‹ РїРѕСЃРјРѕС‚СЂРµС‚СЊ РїРѕРґСЂРѕР±РЅРѕСЃС‚Рё СЃРёРіРЅР°Р»Р°."
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

