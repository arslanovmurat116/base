import Link from "next/link";
import FilterBar from "../../components/filter-bar";
import { buildLeadHref } from "../../lib/lead-links";
import { getLeadsData } from "../../lib/server-data";

export const metadata = {
  title: "Сделки | Mebel RDN CRM"
};

const STATUS_LABELS = {
  NEW: "Новая заявка",
  CONTACTED: "Квалификация",
  QUALIFIED: "Расчёт",
  MEETING: "Замер / консультация",
  PROPOSAL: "КП отправлено",
  WON: "Сделка закрыта",
  LOST: "Потеряно"
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

function formatLeadStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function LeadCard({ lead }) {
  const slug = lead.slug || lead.id;

  return (
    <article className="lead-card">
      <div className="lead-card-head">
        <div>
          <p className="eyebrow">{lead.product || "Сделка"}</p>
          <h2 className="lead-card-title">{lead.name}</h2>
        </div>
        <span className="status-pill">{lead.dealStage || formatLeadStatusLabel(lead.status)}</span>
      </div>

      <p className="lead-card-copy">{lead.summary}</p>

      <div className="chip-row">
        <span className="chip-soft">{lead.source}</span>
        <span className="chip-soft">{lead.channel}</span>
        {lead.tags?.slice(0, 2).map((tag) => (
          <span className="chip-strong" key={tag}>
            {tag}
          </span>
        ))}
      </div>

      <div className="lead-card-grid">
        <article className="detail-card">
          <span>Запрос</span>
          <strong>{lead.requestType || "Не указан"}</strong>
        </article>
        <article className="detail-card">
          <span>Бюджет</span>
          <strong>{lead.budget || "Уточняется"}</strong>
        </article>
        <article className="detail-card">
          <span>Этап сделки</span>
          <strong>{lead.dealStage || formatLeadStatusLabel(lead.status)}</strong>
        </article>
        <article className="detail-card">
          <span>Следующий контакт</span>
          <strong>{lead.nextContactAt || lead.deadline}</strong>
        </article>
        <article className="detail-card">
          <span>Ответственный</span>
          <strong>{lead.manager}</strong>
        </article>
      </div>

      <div className="lead-card-actions">
        <span className="badge-soft">Дедлайн: {lead.deadline}</span>
        <div className="quick-link-row">
          <Link className="ghost-link" href={buildLeadHref(slug, "project")}>
            РџСЂРѕРµРєС‚
          </Link>
          <Link className="ghost-link" href={buildLeadHref(slug, "estimate")}>
            РЎРјРµС‚Р°
          </Link>
          <Link className="ghost-link" href={buildLeadHref(slug, "drawings")}>
            Р§РµСЂС‚РµР¶Рё
          </Link>
        </div>
        <Link className="primary-link" href={buildLeadHref(slug, "summary")}>
          Открыть сделку
        </Link>
      </div>
    </article>
  );
}

export default async function LeadsPage({ searchParams }) {
  const resolved = await searchParams;
  const statusFilter = resolved?.status || "all";
  const leads = await getLeadsData();

  const filteredLeads = [...leads]
    .filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) {
        return false;
      }

      return true;
    })
    .sort((first, second) => {
      return (STATUS_ORDER[first.status] || 99) - (STATUS_ORDER[second.status] || 99);
    });

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Сделки</p>
        <h1>Вся мебельная воронка без перегруза</h1>
        <p>
          Здесь команда видит реальные сделки в одном списке: кто пришёл, что
          хочет клиент, какой у него бюджет, где нужен расчёт, где уже назначен
          замер и у кого пора дожимать после КП.
        </p>
      </section>

      <section className="panel">
        <div className="section-badge-row">
          <span className="badge-soft">{filteredLeads.length} сделок в текущем срезе</span>
          <span className="badge-soft">Фокус на продажах, а не на отчётности</span>
        </div>

        <FilterBar
          title="Статус сделки"
          paramKey="status"
          options={[
            { value: "all", label: "Все" },
            { value: "NEW", label: "Новые" },
            { value: "CONTACTED", label: "Связаться" },
            { value: "QUALIFIED", label: "Расчёт стоимости" },
            { value: "MEETING", label: "Замер" },
            { value: "PROPOSAL", label: "Согласование" },
            { value: "WON", label: "Предоплата / производство" }
          ]}
        />

        <div className="lead-grid">
          {filteredLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      </section>
    </main>
  );
}
