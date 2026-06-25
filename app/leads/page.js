import Link from "next/link";
import FilterBar from "../../components/filter-bar";
import { buildLeadHref } from "../../lib/lead-links";
import { pick } from "../../lib/i18n";
import { getLanguage } from "../../lib/i18n-server";
import {
  translateAmountText,
  translateChannel,
  translateDealStage,
  translateNextStepText,
  translateProduct,
  translateScheduleText,
  translateSource,
  translateTag
} from "../../lib/display-text";
import { getLeadsData } from "../../lib/server-data";

export const metadata = {
  title: "Deals | BOSE"
};

const STATUS_ORDER = {
  NEW: 1,
  CONTACTED: 2,
  QUALIFIED: 3,
  MEETING: 4,
  PROPOSAL: 5,
  WON: 6,
  LOST: 7
};

function formatLeadStatusLabel(status, lang) {
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
      return pick(lang, "Deposit / production", "Предоплата / производство");
    case "LOST":
      return pick(lang, "Lost", "Потеряно");
    default:
      return status;
  }
}

function formatNextStep(value, fallbackSchedule, lang) {
  const source = String(value || "").trim().toLowerCase();

  if (lang === "en") {
    if (source.includes("позвонить") && source.includes("бриф")) {
      return "Call, collect the brief and align the estimate timing";
    }
    if (source.includes("уточнить материалы фасадов")) {
      return "Clarify facade materials and send a preliminary estimate";
    }
    if (source.includes("собрать финальные размеры")) {
      return "Collect final dimensions and issue the estimate";
    }
    if (source.includes("провести замер")) {
      return "Complete the measurement and confirm the estimate timing";
    }
    if (source.includes("вернуться по отправленному кп")) {
      return "Follow up on the sent quote and confirm installation timing";
    }
    if (source.includes("передать в производство")) {
      return "Move to production after the contract is signed";
    }
  }

  return translateNextStepText(
    value,
    lang,
    fallbackSchedule,
    value || fallbackSchedule || "-"
  );
}

function LeadCard({ lead, lang }) {
  const slug = lead.slug || lead.id;
  const statusLabel = formatLeadStatusLabel(lead.status, lang);

  return (
    <article className="lead-card">
      <div className="lead-card-head">
        <div>
          <p className="eyebrow">{translateProduct(lead.product, lang)}</p>
          <h2 className="lead-card-title">{lead.name}</h2>
        </div>
        <span className="status-pill">{statusLabel}</span>
      </div>

      <div className="chip-row">
        <span className="chip-soft">{translateSource(lead.source, lang)}</span>
        <span className="chip-soft">{translateChannel(lead.channel, lang)}</span>
        {lead.tags?.slice(0, 2).map((tag) => (
          <span className="chip-strong" key={tag}>
            {translateTag(tag, lang)}
          </span>
        ))}
      </div>

      <div className="lead-card-grid">
        <article className="detail-card">
          <span>{pick(lang, "Budget", "Бюджет")}</span>
          <strong>{translateAmountText(lead.budget, lang, "Pending", "Уточняется")}</strong>
        </article>
        <article className="detail-card">
          <span>{pick(lang, "Next step", "Следующий шаг")}</span>
          <strong>
            {translateNextStepText(
              formatNextStep(
                lead.nextAction || lead.nextContactAt || lead.deadline,
                translateScheduleText(lead.nextContactAt || lead.deadline, lang, "Open the order card", "Откройте карточку заказа"),
                lang
              ),
              lang,
              translateScheduleText(lead.nextContactAt || lead.deadline, lang, "Open the order card", "Откройте карточку заказа"),
              lead.nextAction || lead.nextContactAt || lead.deadline || "-"
            )}
          </strong>
        </article>
        <article className="detail-card">
          <span>{pick(lang, "Manager", "Ответственный")}</span>
          <strong>{lead.manager}</strong>
        </article>
        <article className="detail-card">
          <span>{pick(lang, "Stage", "Этап")}</span>
          <strong>{translateDealStage(lead.dealStage || lead.status, lang)}</strong>
        </article>
      </div>

      <div className="lead-card-actions">
        <div className="quick-link-row">
          <Link className="ghost-link" href={buildLeadHref(slug, "project")}>
            {pick(lang, "Project", "Проект")}
          </Link>
          <Link className="ghost-link" href={buildLeadHref(slug, "estimate")}>
            {pick(lang, "Estimate", "Смета")}
          </Link>
          <Link className="ghost-link" href={buildLeadHref(slug, "drawings")}>
            {pick(lang, "Drawings", "Чертежи")}
          </Link>
        </div>
        <Link className="primary-link" href={buildLeadHref(slug, "summary")}>
          {pick(lang, "Open deal", "Открыть сделку")}
        </Link>
      </div>
    </article>
  );
}

export default async function LeadsPage({ searchParams }) {
  const lang = await getLanguage();
  const resolved = await searchParams;
  const statusFilter = resolved?.status || "all";
  const leads = await getLeadsData();

  const filteredLeads = [...leads]
    .filter((lead) => (statusFilter !== "all" ? lead.status === statusFilter : true))
    .sort((first, second) => (STATUS_ORDER[first.status] || 99) - (STATUS_ORDER[second.status] || 99));

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{pick(lang, "Deals", "Сделки")}</p>
        <h1>{pick(lang, "A clear pipeline without noise", "Чистая воронка без перегруза")}</h1>
        <p>
          {pick(
            lang,
            "Open the current order flow, see who is waiting for contact, estimate, measurement or approval, and jump into the exact deal card.",
            "Здесь видно текущий поток заказов: кому нужен контакт, расчёт, замер или согласование, и откуда быстро открыть нужную карточку."
          )}
        </p>
      </section>

      <section className="panel">
        <div className="section-badge-row">
          <span className="badge-soft">
            {pick(lang, `${filteredLeads.length} deals in this view`, `${filteredLeads.length} сделок в текущем срезе`)}
          </span>
        </div>

        <FilterBar
          title={pick(lang, "Deal status", "Статус сделки")}
          paramKey="status"
          options={[
            { value: "all", label: pick(lang, "All", "Все") },
            { value: "NEW", label: pick(lang, "New", "Новые") },
            { value: "CONTACTED", label: pick(lang, "Contact", "Связаться") },
            { value: "QUALIFIED", label: pick(lang, "Estimate", "Расчёт") },
            { value: "MEETING", label: pick(lang, "Measurement", "Замер") },
            { value: "PROPOSAL", label: pick(lang, "Approval", "Согласование") },
            { value: "WON", label: pick(lang, "Deposit / production", "Предоплата / производство") }
          ]}
        />

        <div className="lead-grid">
          {filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lang={lang} lead={lead} />
          ))}
        </div>
      </section>
    </main>
  );
}
