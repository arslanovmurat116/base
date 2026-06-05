import Link from "next/link";
import {
  getAppointmentsData,
  getDashboardData,
  getLeadsData,
  getWorkboardData
} from "../lib/server-data";
import {
  getLeadAppointmentHref,
  getLeadStatusHref
} from "../lib/lead-links";

function StatCard({ label, value, note, href }) {
  const content = (
    <>
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </>
  );

  if (href) {
    return (
      <Link className="stat-card stat-card-link" href={href}>
        {content}
      </Link>
    );
  }

  return <article className="stat-card">{content}</article>;
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function QueueCard({ item }) {
  const href = getLeadStatusHref(item.slug, item.status);
  const content = (
    <>
      <div>
        <h3>{item.lead}</h3>
        <p>{item.source}</p>
      </div>
      <div className="queue-side">
        <span>{item.owner}</span>
        <strong>{item.deadline}</strong>
        <em>{formatLeadStatus(item.status)}</em>
      </div>
    </>
  );

  if (href) {
    return (
      <Link className="queue-item queue-item-link-card" href={href}>
        {content}
      </Link>
    );
  }

  return <article className="queue-item">{content}</article>;
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

function getStageHref(stageName) {
  switch (stageName) {
    case "Новая заявка":
      return "/leads?status=NEW";
    case "Связаться":
      return "/leads?status=CONTACTED";
    case "Расчёт стоимости":
      return "/leads?status=QUALIFIED";
    case "Замер назначен":
      return "/leads?status=MEETING";
    case "Согласование":
      return "/leads?status=PROPOSAL";
    default:
      return "/leads";
  }
}

function getDashboardStatHref(index) {
  const hrefs = [
    "/leads?status=NEW",
    "/appointments?status=SCHEDULED",
    "/appointments?status=CONFIRMED",
    "/workboard?view=alerts"
  ];

  return hrefs[index] || "/workboard";
}

export default async function HomePage() {
  const [dashboard, appointments, leads, workboard] = await Promise.all([
    getDashboardData(),
    getAppointmentsData(),
    getLeadsData(),
    getWorkboardData()
  ]);

  const activeDeals = leads.filter(
    (lead) => !["WON", "LOST"].includes(String(lead.status))
  ).length;
  const estimateBacklog = leads.filter((lead) =>
    ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(String(lead.status))
  ).length;
  const upcomingMeasurements = appointments.filter((item) =>
    ["SCHEDULED", "CONFIRMED"].includes(String(item.status))
  );
  const nextMeasurements = [...upcomingMeasurements]
    .sort((first, second) => {
      const firstDate = first.scheduledAtIso
        ? new Date(first.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      const secondDate = second.scheduledAtIso
        ? new Date(second.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate;
    })
    .slice(0, 4);

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Мебельный MVP</p>
          <h1>Заявки, расчёты и замеры в одном понятном контуре.</h1>
          <p className="hero-text">
            Это рабочий слой для мебельного бизнеса: взять входящий лид, быстро
            квалифицировать, дать диапазон цены, назначить замер и не потерять
            сделку на повторном контакте. Без лишних модулей, без серой админки и без
            абстрактного AI-шума.
          </p>

          <div className="hero-tag-row">
            <span className="hero-tag">Кухни</span>
            <span className="hero-tag">Шкафы и гардеробные</span>
            <span className="hero-tag">Корпусная мебель</span>
            <span className="hero-tag">Замер и расчёт</span>
          </div>

          <div className="quick-link-row">
            <Link className="primary-link" href="/workboard">
              Открыть смену
            </Link>
            <Link className="ghost-link" href="/leads">
              Перейти к сделкам
            </Link>
          </div>
        </div>

        <div className="hero-aside">
          <Link className="hero-kpi-card hero-kpi-link" href="/leads">
            <p className="eyebrow">Активный контур</p>
            <strong>{activeDeals}</strong>
            <p>Сделок сейчас в работе: от новой заявки до расчёта, замера и предоплаты.</p>
          </Link>
          <Link className="hero-kpi-card hero-kpi-link" href="/leads?status=QUALIFIED">
            <p className="eyebrow">На расчёт</p>
            <strong>{estimateBacklog}</strong>
            <p>Клиентов ждут следующий шаг, смета или аккуратный возврат по цене.</p>
          </Link>
          <Link className="hero-kpi-card hero-kpi-link" href="/appointments?status=CONFIRMED">
            <p className="eyebrow">Ближайшие замеры</p>
            <strong>{upcomingMeasurements.length}</strong>
            <p>Подтверждённые выезды и консультации, которые двигают сделки дальше.</p>
          </Link>
        </div>
      </section>

      <section className="stats-grid">
        {dashboard.stats.map((item, index) => (
          <StatCard key={item.label} {...item} href={getDashboardStatHref(index)} />
        ))}
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <SectionTitle
            eyebrow="Воронка"
            title="Где сейчас стоят сделки"
            text="На старте нам нужна не сложная аналитика, а честная картина: сколько заявок ещё свежие, сколько уже ждут расчёта, где назначен замер и где пора дожимать после КП."
          />

          <div className="stage-list">
            {dashboard.stages.map((stage) => (
              <Link className="stage-row stage-row-link" href={getStageHref(stage.name)} key={stage.name}>
                <div className="stage-meta">
                  <span
                    className="stage-dot"
                    style={{ backgroundColor: stage.tone }}
                  />
                  <span>{stage.name}</span>
                </div>
                <strong>{stage.count}</strong>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionTitle
            eyebrow="Очередь"
            title="Кому команда должна ответить сегодня"
            text="Это не дашборд ради дашборда. Это короткая очередь по тем клиентам, где скорость ответа и следующий шаг прямо влияют на деньги."
          />

          <div className="queue-list">
            {workboard.urgentLeads.slice(0, 4).map((item) => (
              <QueueCard key={`${item.lead}-${item.deadline}`} item={item} />
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <SectionTitle
            eyebrow="Источники"
            title="Что даёт не только трафик, но и реальные сделки"
            text="Для мебельного бизнеса важен не просто объём заявок. Нужно видеть, какой канал даёт тёплых клиентов, у кого быстрее происходит расчёт и где менеджер не тратит время впустую."
          />

          <div className="source-grid">
            {dashboard.sources.map((item) => (
              <Link className="source-card source-card-link" href="/leads" key={item.name}>
                <h3>{item.name}</h3>
                <dl>
                  <div>
                    <dt>Лиды</dt>
                    <dd>{item.leads}</dd>
                  </div>
                  <div>
                    <dt>CPL</dt>
                    <dd>{item.cpl}</dd>
                  </div>
                  <div>
                    <dt>Сигнал</dt>
                    <dd>{item.result}</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel">
          <SectionTitle
            eyebrow="Ближайшие выезды"
            title="Замеры и консультации, которые нельзя потерять"
            text="Отдельный контур под выезды помогает не забыть про адрес, подтверждение, шоурум и всё то, из-за чего мебельная сделка часто ломается уже после хорошего первого контакта."
          />

          <div className="compact-list">
            {nextMeasurements.map((item) => (
              <article className="compact-item" key={item.id}>
                <div className="compact-item-head">
                  <strong>
                    {getLeadAppointmentHref(item) ? (
                      <Link className="work-item-link" href={getLeadAppointmentHref(item)}>
                        {item.lead}
                      </Link>
                    ) : (
                      item.lead
                    )}
                  </strong>
                  <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
                    {formatAppointmentStatus(item.status)}
                  </span>
                </div>
                <p className="compact-note">{item.note}</p>
                <div className="compact-meta">
                  <span>{formatAppointmentType(item.type)}</span>
                  <span>{item.scheduledAt}</span>
                  <span>{item.location}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <SectionTitle
          eyebrow="Стартовый контур"
          title="Что входит в сильный мебельный MVP"
          text="На первом этапе проект не расползается в производство, финансы и десятки кабинетов. Здесь только тот минимум, который реально двигает продажи и дисциплинирует команду."
        />

        <div className="module-grid">
          {dashboard.modules.map((item) => (
            <article className="module-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
