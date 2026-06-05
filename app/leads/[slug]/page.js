import Link from "next/link";
import { notFound } from "next/navigation";
import AppointmentCreateForm from "../../../components/appointment-create-form";
import AppointmentStatusForm from "../../../components/appointment-status-form";
import FollowupCompleteButton from "../../../components/followup-complete-button";
import FollowupCreateForm from "../../../components/followup-create-form";
import LeadProjectFileDeleteButton from "../../../components/lead-project-file-delete-button";
import LeadOrderContextForm from "../../../components/lead-order-context-form";
import LeadProjectFilesForm from "../../../components/lead-project-files-form";
import LeadProductionContextForm from "../../../components/lead-production-context-form";
import LeadWorkflowForm from "../../../components/lead-workflow-form";
import ManagerOutcomeForm from "../../../components/manager-outcome-form";
import TaskCompleteButton from "../../../components/task-complete-button";
import { getLeadBySlug, getLeadStatusOptions } from "../../../lib/server-data";

const STATUS_LABELS = {
  NEW: "Новая заявка",
  CONTACTED: "Связаться",
  QUALIFIED: "Расчёт стоимости",
  MEETING: "Замер назначен",
  PROPOSAL: "Согласование",
  WON: "Предоплата / производство",
  LOST: "Отказ"
};

function formatLeadStatus(status) {
  return STATUS_LABELS[status] || status;
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

function formatTaskStatus(status) {
  switch (status) {
    case "OPEN":
      return "Открыта";
    case "DONE":
      return "Закрыта";
    default:
      return status;
  }
}

function formatFollowupStatus(status) {
  switch (status) {
    case "PENDING":
      return "Запланирован";
    case "DONE":
      return "Выполнен";
    default:
      return status;
  }
}

function formatRequestTrack(track) {
  switch (track) {
    case "booking":
      return "Замер / выезд";
    case "estimate":
      return "Расчёт";
    case "consultation":
      return "Консультация";
    case "explore":
      return "Подогрев";
    default:
      return "Общий поток";
  }
}

function formatPriority(priority) {
  switch (priority) {
    case "high":
      return "Высокий приоритет";
    case "medium":
      return "Средний приоритет";
    case "low":
      return "Низкий приоритет";
    default:
      return priority || "Без приоритета";
  }
}

function formatOrderQuantity(value) {
  const numeric = Number(value || 0);

  if (!numeric || Number.isNaN(numeric)) {
    return "1 шт.";
  }

  return `${numeric} шт.`;
}

function formatYesNo(value) {
  return value ? "Да" : "Нет";
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const lead = await getLeadBySlug(resolved.slug);

  return {
    title: lead ? `${lead.name} | Сделка` : "Сделка не найдена | Mebel RDN CRM"
  };
}

function DetailCard({ label, value }) {
  return (
    <article className="detail-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MiniListSection({ id, eyebrow, title, emptyText, items, renderItem }) {
  return (
    <section className="panel lead-section-anchor" id={id}>
      <div className="section-title">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <div className="compact-list">
        {items.length ? items.map(renderItem) : <article className="timeline-empty">{emptyText}</article>}
      </div>
    </section>
  );
}

export default async function LeadDetailPage({ params }) {
  const resolved = await params;
  const lead = await getLeadBySlug(resolved.slug);

  if (!lead) {
    notFound();
  }

  const statusOptions = getLeadStatusOptions();
  const nextAppointment = [...(lead.appointments || [])]
    .filter((item) => ["SCHEDULED", "CONFIRMED"].includes(String(item.status)))
    .sort((first, second) => {
      const firstDate = first.scheduledAtIso
        ? new Date(first.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      const secondDate = second.scheduledAtIso
        ? new Date(second.scheduledAtIso).getTime()
        : Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate;
    })[0];

  const nextFollowup = (lead.followups || []).find(
    (item) => String(item.status) === "PENDING"
  );
  const openTasksCount = (lead.tasks || []).filter(
    (item) => String(item.status) === "OPEN"
  ).length;
  const project = lead.project || {};
  const calculation = lead.order?.calculation || lead.postMeasurementCard?.calculation || {};
  const estimate = lead.order?.estimate || {};
  const projectAssets = lead.projectAssets || project.assets || {};
  const projectFiles = projectAssets.files || [];
  const projectPreviews = projectAssets.previews || [];
  const estimateExport = estimate.export || projectAssets.estimate || {};
  const production = lead.order?.production || lead.postMeasurementCard?.production || {};
  const installation =
    lead.order?.installation || lead.postMeasurementCard?.installation || {};
  const orderItems = lead.order?.items || [];
  const estimateItems = estimate.items || [];
  const estimatePaymentPlan = estimate.paymentPlan || [];
  const productionStages = [
    {
      title: "Проект",
      value: production.projectStatus || "Не запущено",
      note: project.status || "Статус проекта не зафиксирован"
    },
    {
      title: "Распил",
      value: production.cuttingStatus || "Не запущено",
      note: `Ответственный: ${production.stageOwner || "Не назначен"}`
    },
    {
      title: "Сборка",
      value: production.assemblyStatus || "Не запущено",
      note: `Дедлайн: ${production.deadline || "Не назначен"}`
    },
    {
      title: "Установка",
      value: production.installationStatus || "Не запущено",
      note: installation.date || "Дата установки не назначена"
    },
    {
      title: "Финальный платёж",
      value: production.finalPaymentStatus || "Не запрошен",
      note: installation.status || "Статус установки не зафиксирован"
    }
  ];
  const quickSections = [
    {
      href: "#deal-summary",
      label: "Сводка",
      value: lead.dealStage || formatLeadStatus(lead.status),
      note: lead.nextAction || "Следующий шаг не зафиксирован"
    },
    {
      href: "#deal-project",
      label: "Проект и расчёт",
      value: project.status || calculation.finalAmount || "Черновик",
      note: calculation.finalAmount || lead.estimateRange || "Сумма уточняется"
    },
    {
      href: "#deal-production",
      label: "Производство",
      value: production.stage || production.overall || "Не запущено",
      note: production.deadline || "Дедлайн не назначен"
    },
    {
      href: "#deal-measurements",
      label: "Замеры",
      value: lead.measurementStatus || "Не назначен",
      note: nextAppointment?.scheduledAt || "Следующего выезда пока нет"
    },
    {
      href: "#deal-followups",
      label: "Возврат и шаг",
      value: nextFollowup?.scheduledAt || `${openTasksCount} задач`,
      note: nextFollowup?.type || "Точка возврата пока не назначена"
    },
    {
      href: "#deal-history",
      label: "История",
      value: `${lead.messages?.length || 0} сообщений`,
      note: lead.activity?.[0]?.time || "Журнал ещё пустой"
    }
  ];
  const projectSectionLinks = [
    { href: "#deal-project-editor", label: "\u041f\u0440\u043e\u0435\u043a\u0442" },
    { href: "#deal-project-preview", label: "\u041f\u0440\u0435\u0432\u044c\u044e" },
    { href: "#deal-project-files", label: "\u0424\u0430\u0439\u043b\u044b" },
    { href: "#deal-estimate", label: "\u0421\u043c\u0435\u0442\u0430" },
    { href: "#deal-drawings", label: "\u0427\u0435\u0440\u0442\u0435\u0436\u0438" },
    { href: "#deal-order-items", label: "\u0421\u043e\u0441\u0442\u0430\u0432 \u0437\u0430\u043a\u0430\u0437\u0430" },
    { href: "#deal-production-editor", label: "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0441\u0442\u0432\u043e" }
  ];

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">Сделка</p>
        <h1>{lead.name}</h1>
        <p>
          Карточка сделки должна помогать менеджеру продавать, а не просто
          хранить данные. Здесь собран контекст клиента, запрос по мебели,
          расчёт, замер, история контактов и следующий шаг по деньгам.
        </p>
      </section>

      <section className="lead-quick-nav" aria-label="Быстрая навигация по сделке">
        {quickSections.map((item) => (
          <Link className="lead-quick-link" href={item.href} key={item.href}>
            <span className="eyebrow">{item.label}</span>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </Link>
        ))}
      </section>

      <div className="lead-detail-grid">
        <section className="panel lead-summary-panel lead-section-anchor" id="deal-summary">
          <div className="section-badge-row">
            <span className="badge-soft">{lead.channel}</span>
            <span className="badge-soft">{lead.source}</span>
            <span className="badge-soft">{lead.dealStage || formatLeadStatus(lead.status)}</span>
          </div>

          <h2 className="lead-title">{lead.name}</h2>
          <p className="lead-summary-text">{lead.summary}</p>

          <div className="chip-row">
            {(lead.tags || []).map((tag) => (
              <span className="chip-strong" key={tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className="detail-grid">
            <DetailCard label="Изделие" value={lead.product || "Не указано"} />
            <DetailCard label="Запрос" value={lead.requestType || "Не указан"} />
            <DetailCard label="Бюджет" value={lead.budget || "Уточняется"} />
            <DetailCard label="Статус расчёта" value={lead.calculationStatus || "Уточняется"} />
            <DetailCard label="Ответственный" value={lead.manager || "Не назначен"} />
            <DetailCard label="Адрес" value={lead.address || lead.city || "Не указано"} />
            <DetailCard label="Срочность" value={lead.urgency || "Обычная"} />
            <DetailCard label="Следующий контакт" value={lead.nextContactAt || "Не назначен"} />
            <DetailCard label="Статус предоплаты" value={lead.prepaymentStatus || "Не запрошена"} />
            <DetailCard label="Предоплата" value={lead.prepaymentAmount || "Не внесена"} />
            <DetailCard label="Итоговая сумма" value={lead.finalAmount || lead.estimateRange || "Уточняется"} />
            <DetailCard label="Следующий шаг" value={lead.nextAction || "Не зафиксирован"} />
          </div>

          <div className="lead-action-bar">
            <Link className="ghost-link" href="/leads">
              Вернуться к списку
            </Link>
            <Link className="primary-link" href="/appointments">
              Открыть контур замеров
            </Link>
          </div>
        </section>

        <section className="panel lead-section-anchor" id="deal-context">
          <div className="section-title">
            <p className="eyebrow">Контекст</p>
            <h2>Что важно по сделке прямо сейчас</h2>
            <p>
              Этот блок нужен, чтобы менеджер не перечитывал всю переписку с
              нуля и сразу понимал, где деньги: в расчёте, в выезде, в дожиме
              после КП или в уточнении бюджета.
            </p>
          </div>

          <div className="compact-list">
            <article className="summary-card">
              <strong>Проект клиента</strong>
              <p>{lead.projectSize || "Размер проекта ещё не зафиксирован."}</p>
              <dl>
                <div>
                  <dt>Телефон</dt>
                  <dd>{lead.phone || "Не указан"}</dd>
                </div>
                <div>
                  <dt>Срочность</dt>
                  <dd>{lead.urgency || "Не определена"}</dd>
                </div>
                <div>
                  <dt>Трек запроса</dt>
                  <dd>{formatRequestTrack(lead.intakeSession?.requestTrack)}</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card">
              <strong>Комментарий по клиенту</strong>
              <p>{lead.clientComment || lead.managerComment || "Комментарий пока не добавлен."}</p>
            </article>

            <article className="summary-card">
              <strong>Ближайшая точка контроля</strong>
              <p>
                {nextAppointment
                  ? `${formatAppointmentType(nextAppointment.type)}: ${nextAppointment.scheduledAt}`
                  : "Замер или встреча пока не назначены."}
              </p>
              <dl>
                <div>
                  <dt>Статус замера</dt>
                  <dd>{lead.measurementStatus || "Не назначен"}</dd>
                </div>
                <div>
                  <dt>Следующий возврат</dt>
                  <dd>{nextFollowup?.scheduledAt || "Не назначен"}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
      </div>

      <section
        className="panel lead-section-anchor"
        id="deal-project"
        style={{ marginTop: 18 }}
      >
        <div className="section-title">
          <p className="eyebrow">Проект / заказ</p>
          <h2>Проект, размеры и весь заказ живут внутри карточки CRM</h2>
          <p>
            После замера система собирает не просто заметку, а рабочую карточку
            проекта: размеры, состав мебели, деньги и производственные этапы.
            Это основной источник правды по заказу, а не отдельная таблица.
          </p>
        </div>

        <div className="quick-link-row">
          {projectSectionLinks.map((item) => (
            <Link className="filter-pill" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>

        <div className="compact-list">
          <article className="summary-card">
            <strong>Проект</strong>
            <p>{project.description || project.layout || lead.projectSize || "Состав проекта уточняется."}</p>
            <dl>
              <div>
                <dt>Статус проекта</dt>
                <dd>{project.status || "Черновик"}</dd>
              </div>
              <div>
                <dt>Материалы</dt>
                <dd>{project.materials || "Уточняются"}</dd>
              </div>
              <div>
                <dt>Фурнитура</dt>
                <dd>{project.hardware || "Уточняется"}</dd>
              </div>
              <div>
                <dt>Цвет</dt>
                <dd>{project.color || "Уточняется"}</dd>
              </div>
              <div>
                <dt>Комментарий проектировщика</dt>
                <dd>{project.designerComment || "Пока не добавлен"}</dd>
              </div>
              <div>
                <dt>Дата подготовки проекта</dt>
                <dd>{project.preparedAt || "Не подготовлен"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card lead-section-anchor" id="deal-drawings">
            <strong>Р§РµСЂС‚РµР¶Рё</strong>
            <p>{project.layout || project.measurements || "РљРѕРјРїРѕРЅРѕРІРєР° Рё С‡РµСЂС‚РµР¶Рё СЃРѕР±РёСЂР°СЋС‚СЃСЏ РїРѕСЃР»Рµ Р·Р°РјРµСЂР°."}</p>
            <dl>
              <div>
                <dt>РЎС‚Р°С‚СѓСЃ С‡РµСЂС‚РµР¶РµР№</dt>
                <dd>{project.designStatus || project.status || "Р•С‰С‘ РЅРµ СЃРѕР±СЂР°РЅС‹"}</dd>
              </div>
              <div>
                <dt>РСЃС‚РѕС‡РЅРёРє СЂР°Р·РјРµСЂРѕРІ</dt>
                <dd>{project.measurementsSource || "РќРµ СѓРєР°Р·Р°РЅ"}</dd>
              </div>
              <div>
                <dt>РљРѕРјРїРѕРЅРѕРІРєР°</dt>
                <dd>{project.layout || "РЈС‚РѕС‡РЅСЏРµС‚СЃСЏ"}</dd>
              </div>
              <div>
                <dt>Р Р°Р·РјРµСЂС‹</dt>
                <dd>{project.measurements || "Р‘СѓРґСѓС‚ РїРѕСЃР»Рµ Р·Р°РјРµСЂР°"}</dd>
              </div>
              <div>
                <dt>РљРѕРјРјРµРЅС‚Р°СЂРёР№</dt>
                <dd>{project.designerComment || "РџРѕРєР° РЅРµ РґРѕР±Р°РІР»РµРЅ"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>Расчёт</strong>
            <p>{lead.order?.orderCode || "Код заказа будет после подтверждения"}</p>
            <dl>
              <div>
                <dt>Предварительная сумма</dt>
                <dd>{calculation.preliminaryAmount || lead.order?.preliminaryAmount || lead.order?.estimateRange || "Уточняется"}</dd>
              </div>
              <div>
                <dt>Итоговая сумма</dt>
                <dd>{calculation.finalAmount || lead.order?.finalAmount || lead.finalAmount || "Уточняется"}</dd>
              </div>
              <div>
                <dt>Сумма предоплаты</dt>
                <dd>{calculation.prepaymentAmount || lead.order?.prepaymentAmount || "Не внесена"}</dd>
              </div>
              <div>
                <dt>Остаток к оплате</dt>
                <dd>{calculation.balanceDue || lead.order?.balanceDue || "Уточняется"}</dd>
              </div>
              <div>
                <dt>Статус предоплаты</dt>
                <dd>{calculation.prepaymentStatus || lead.prepaymentStatus || "Не запрошена"}</dd>
              </div>
              <div>
                <dt>Статус окончательной оплаты</dt>
                <dd>{calculation.finalPaymentStatus || production.finalPaymentStatus || "Не запрошена"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>Производство</strong>
            <p>{production.overall || lead.productionStatus || "Не запущено"}</p>
            <dl>
              <div>
                <dt>Передано в производство</dt>
                <dd>{formatYesNo(production.handedToProduction)}</dd>
              </div>
              <div>
                <dt>Дата передачи</dt>
                <dd>{production.handoverDate || "Не передано"}</dd>
              </div>
              <div>
                <dt>Этап производства</dt>
                <dd>{production.stage || "Не запущено"}</dd>
              </div>
              <div>
                <dt>Ответственный этап</dt>
                <dd>{production.stageOwner || "Не назначен"}</dd>
              </div>
              <div>
                <dt>Дедлайн</dt>
                <dd>{production.deadline || "Не назначен"}</dd>
              </div>
              <div>
                <dt>Комментарий производства</dt>
                <dd>{production.comment || "Пока не добавлен"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>Установка</strong>
            <p>{installation.status || "Не назначена"}</p>
            <dl>
              <div>
                <dt>Дата установки</dt>
                <dd>{installation.date || "Не назначена"}</dd>
              </div>
              <div>
                <dt>Адрес установки</dt>
                <dd>{installation.address || lead.address || "Не указан"}</dd>
              </div>
              <div>
                <dt>Монтажник</dt>
                <dd>{installation.installer || "Не назначен"}</dd>
              </div>
              <div>
                <dt>Статус установки</dt>
                <dd>{installation.status || "Не назначена"}</dd>
              </div>
              <div>
                <dt>Комментарий</dt>
                <dd>{installation.comment || "Пока не добавлен"}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <section
        className="panel lead-section-anchor"
        id="deal-project-preview"
        style={{ marginTop: 18 }}
      >
        <div className="section-title">
          <p className="eyebrow">{"\u041f\u0440\u0435\u0432\u044c\u044e \u043f\u0440\u043e\u0435\u043a\u0442\u0430"}</p>
          <h2>{"\u0421\u043a\u0440\u0438\u043d\u044b \u0438 \u0440\u0435\u043d\u0434\u0435\u0440\u044b \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443"}</h2>
          <p>
            {"\u042d\u0442\u043e \u0431\u044b\u0441\u0442\u0440\u044b\u0439 \u0432\u0445\u043e\u0434 \u0432 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442: \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u0438 \u043a\u043b\u0438\u0435\u043d\u0442 \u0441\u0440\u0430\u0437\u0443 \u0432\u0438\u0434\u044f\u0442 \u0440\u0435\u043d\u0434\u0435\u0440, 3D-\u0432\u0438\u0434 \u0438 \u0442\u0435\u0445\u043b\u0438\u0441\u0442 \u0431\u0435\u0437 \u043e\u0442\u043a\u0440\u044b\u0442\u0438\u044f \u0432\u043d\u0435\u0448\u043d\u0435\u0439 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b."}
          </p>
        </div>

        {projectPreviews.length ? (
          <div className="project-preview-grid">
            {projectPreviews.map((item) => (
              <article className="project-preview-card" key={item.id}>
                <a href={item.url} rel="noreferrer" target="_blank">
                  <img
                    alt={item.title}
                    className="project-preview-image"
                    loading="lazy"
                    src={item.url}
                  />
                </a>
                <div className="project-preview-body">
                  <div className="mini-item-head">
                    <strong>{item.title}</strong>
                    <span className="status-chip">
                      {item.updatedAt || "\u0414\u0430\u0442\u0430 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}
                    </span>
                  </div>
                  <p className="compact-note">{item.note}</p>
                  <div className="workflow-actions">
                    <a className="ghost-link" href={item.url} rel="noreferrer" target="_blank">
                      {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0435\u0432\u044c\u044e"}
                    </a>
                    <LeadProjectFileDeleteButton
                      slug={resolved.slug}
                      slot={item.id}
                      title={item.title}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <article className="timeline-empty">
            {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043f\u0440\u0435\u0432\u044c\u044e \u043f\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0443: \u0441\u044e\u0434\u0430 \u0431\u0443\u0434\u0443\u0442 \u043f\u043e\u043f\u0430\u0434\u0430\u0442\u044c \u0440\u0435\u043d\u0434\u0435\u0440\u044b, \u0441\u043a\u0440\u0438\u043d\u044b \u043c\u043e\u0434\u0435\u043b\u0438 \u0438 \u0441\u043a\u0440\u0438\u043d\u044b \u0441\u043c\u0435\u0442\u044b."}
          </article>
        )}
      </section>

      <section
        className="panel lead-section-anchor"
        id="deal-project-files"
        style={{ marginTop: 18 }}
      >
        <div className="section-title">
          <p className="eyebrow">{"\u0424\u0430\u0439\u043b\u044b \u043f\u0440\u043e\u0435\u043a\u0442\u0430"}</p>
          <h2>{"\u0418\u0441\u0445\u043e\u0434\u043d\u0438\u043a\u0438, \u0447\u0435\u0440\u0442\u0435\u0436\u0438 \u0438 \u0441\u043c\u0435\u0442\u0430 \u0432 \u043e\u0434\u043d\u043e\u043c \u043c\u0435\u0441\u0442\u0435"}</h2>
          <p>
            {"\u0417\u0434\u0435\u0441\u044c \u043a\u0430\u0440\u0442\u043e\u0447\u043a\u0430 \u0445\u0440\u0430\u043d\u0438\u0442 \u043d\u0435 \u0441\u0430\u043c \u043f\u0440\u043e\u0435\u043a\u0442, \u0430 \u0441\u0441\u044b\u043b\u043a\u0438 \u043d\u0430 \u0444\u0430\u0439\u043b\u044b \u0438\u0437 \u0432\u043d\u0435\u0448\u043d\u0435\u0439 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b, \u0447\u0442\u043e\u0431\u044b \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440, \u0434\u0438\u0440\u0435\u043a\u0442\u043e\u0440 \u0438 \u0446\u0435\u0445 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u043b\u0438 \u0438\u0445 \u0438\u0437 \u043e\u0434\u043d\u043e\u0439 \u0441\u0434\u0435\u043b\u043a\u0438."}
          </p>
        </div>

        <div className="compact-list">
          <article className="summary-card">
            <strong>{"\u0421\u0442\u0430\u0442\u0443\u0441 \u0432\u044b\u0433\u0440\u0443\u0437\u043a\u0438"}</strong>
            <p>{projectAssets.sourceProgram || "\u0412\u043d\u0435\u0448\u043d\u044f\u044f \u043f\u0440\u043e\u0435\u043a\u0442\u043d\u0430\u044f \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430"}</p>
            <dl>
              <div>
                <dt>{"\u0412\u0435\u0440\u0441\u0438\u044f"}</dt>
                <dd>{projectAssets.version || "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a"}</dd>
              </div>
              <div>
                <dt>{"\u0414\u0430\u0442\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430"}</dt>
                <dd>{projectAssets.exportedAt || project.preparedAt || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}</dd>
              </div>
              <div>
                <dt>{"\u041a\u0442\u043e \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b"}</dt>
                <dd>{projectAssets.uploadedBy || lead.manager || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"}</dd>
              </div>
              <div>
                <dt>{"\u0427\u0442\u043e \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e"}</dt>
                <dd>{projectAssets.actuality || "\u0421\u0442\u0430\u0442\u0443\u0441 \u043d\u0435 \u0437\u0430\u0434\u0430\u043d"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>{"\u0421\u043c\u0435\u0442\u0430 \u0438\u0437 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430"}</strong>
            <p>{estimateExport.sourceLabel || "\u0424\u0430\u0439\u043b \u0441\u043c\u0435\u0442\u044b \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d"}</p>
            <dl>
              <div>
                <dt>{"\u0412\u0435\u0440\u0441\u0438\u044f"}</dt>
                <dd>{estimateExport.version || "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a"}</dd>
              </div>
              <div>
                <dt>{"\u0414\u0430\u0442\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430"}</dt>
                <dd>{estimateExport.exportedAt || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}</dd>
              </div>
              <div>
                <dt>{"\u041b\u0438\u0441\u0442\u044b"}</dt>
                <dd>{estimateExport.sheets?.length ? estimateExport.sheets.join(", ") : "\u041d\u0435\u0442"}</dd>
              </div>
              <div>
                <dt>{"\u0421\u0442\u0430\u0442\u0443\u0441"}</dt>
                <dd>{estimateExport.actuality || "\u041d\u0435 \u0437\u0430\u0434\u0430\u043d"}</dd>
              </div>
            </dl>
            <div className="workflow-actions">
              {estimateExport.fileUrl ? (
                <a className="ghost-link" download href={estimateExport.fileUrl}>
                  {"\u0421\u043a\u0430\u0447\u0430\u0442\u044c Excel"}
                </a>
              ) : null}
              {estimateExport.previewUrl ? (
                <a
                  className="ghost-link"
                  href={estimateExport.previewUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0435\u0432\u044c\u044e"}
                </a>
              ) : null}
            </div>
          </article>
        </div>

        <div className="compact-list" style={{ marginTop: 18 }}>
          {projectFiles.length ? (
            projectFiles.map((file) => (
              <article className="summary-card" key={file.id}>
                <div className="mini-item-head">
                  <strong>{file.title}</strong>
                  <span className="status-chip">
                    {file.available
                      ? "\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u043b\u0451\u043d"
                      : "\u0421\u043b\u043e\u0442"}
                  </span>
                </div>
                <p>{file.note}</p>
                <dl>
                  <div>
                    <dt>{"\u0424\u043e\u0440\u043c\u0430\u0442"}</dt>
                    <dd>{file.type}</dd>
                  </div>
                  <div>
                    <dt>{"\u041e\u0431\u043d\u043e\u0432\u043b\u0451\u043d"}</dt>
                    <dd>{file.updatedAt || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e"}</dd>
                  </div>
                  <div>
                    <dt>{"\u041e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d"}</dt>
                    <dd>{file.required ? "\u0414\u0430" : "\u041d\u0435\u0442"}</dd>
                  </div>
                </dl>
                <div className="workflow-actions">
                  {file.available ? (
                    <>
                      <a
                        className="primary-link"
                        download={file.type !== "image"}
                        href={file.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {"\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0444\u0430\u0439\u043b"}
                      </a>
                      <LeadProjectFileDeleteButton
                        slug={resolved.slug}
                        slot={file.id}
                        title={file.title}
                      />
                    </>
                  ) : (
                    <span className="badge-soft">
                      {"\u0415\u0449\u0451 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d"}
                    </span>
                  )}
                </div>
              </article>
            ))
          ) : (
            <article className="timeline-empty">
              {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u043f\u0440\u0438\u043a\u0440\u0435\u043f\u043b\u0451\u043d\u043d\u044b\u0445 \u0444\u0430\u0439\u043b\u043e\u0432 \u043f\u043e \u043f\u0440\u043e\u0435\u043a\u0442\u0443."}
            </article>
          )}
        </div>

        <div className="compact-list" style={{ marginTop: 18 }}>
          <LeadProjectFilesForm
            initialEstimateExport={estimateExport}
            initialProjectAssets={projectAssets}
            managerName={lead.manager}
            slug={resolved.slug}
          />
        </div>
      </section>

      <section
        className="panel lead-section-anchor"
        id="deal-estimate"
        style={{ marginTop: 18 }}
      >
        <div className="section-title">
          <p className="eyebrow">{"\u0421\u043c\u0435\u0442\u0430"}</p>
          <h2>{"\u0420\u0430\u0437\u0431\u0438\u0432\u043a\u0430 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043f\u043e \u0437\u0430\u043a\u0430\u0437\u0443"}</h2>
          <p>
            {estimate.note ||
              "\u0412 \u044d\u0442\u043e\u043c \u0431\u043b\u043e\u043a\u0435 \u043c\u0435\u043d\u0435\u0434\u0436\u0435\u0440 \u0432\u0438\u0434\u0438\u0442 \u0441\u043e\u0441\u0442\u0430\u0432 \u0441\u043c\u0435\u0442\u044b, \u0438\u0442\u043e\u0433, \u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u0443 \u0438 \u043e\u0441\u0442\u0430\u0442\u043e\u043a \u043a \u043e\u043f\u043b\u0430\u0442\u0435."}
          </p>
        </div>

        <div className="compact-list">
          <article className="summary-card">
            <strong>{estimate.versionLabel || "\u0421\u043c\u0435\u0442\u0430"}</strong>
            <p>{estimate.status || lead.calculationStatus || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"}</p>
            <dl>
              <div>
                <dt>{"\u041f\u043e\u0437\u0438\u0446\u0438\u0439 \u0432 \u0441\u043c\u0435\u0442\u0435"}</dt>
                <dd>{String(estimate.itemsCount || estimateItems.length || 0)}</dd>
              </div>
              <div>
                <dt>{"\u041f\u0440\u0435\u0434\u0432\u0430\u0440\u0438\u0442\u0435\u043b\u044c\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430"}</dt>
                <dd>{estimate.preliminaryAmount || calculation.preliminaryAmount || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"}</dd>
              </div>
              <div>
                <dt>{"\u0418\u0442\u043e\u0433 \u043f\u043e \u043f\u043e\u0437\u0438\u0446\u0438\u044f\u043c"}</dt>
                <dd>{estimate.subtotal || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"}</dd>
              </div>
              <div>
                <dt>{"\u0418\u0442\u043e\u0433\u043e\u0432\u0430\u044f \u0441\u0443\u043c\u043c\u0430"}</dt>
                <dd>{estimate.finalAmount || calculation.finalAmount || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"}</dd>
              </div>
              <div>
                <dt>{"\u0414\u0430\u0442\u0430 \u0441\u0431\u043e\u0440\u043a\u0438 \u0441\u043c\u0435\u0442\u044b"}</dt>
                <dd>{estimate.preparedAt || project.preparedAt || "\u0415\u0449\u0451 \u043d\u0435 \u0437\u0430\u0444\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u0430"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>{"\u041e\u043f\u043b\u0430\u0442\u0430 \u0438 \u043e\u0441\u0442\u0430\u0442\u043e\u043a"}</strong>
            <p>{calculation.prepaymentStatus || "\u041f\u043b\u0430\u0442\u0451\u0436\u0438 \u0435\u0449\u0451 \u043d\u0435 \u0437\u0430\u043a\u0440\u0435\u043f\u043b\u0435\u043d\u044b"}</p>
            <dl>
              <div>
                <dt>{"\u041f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u0430"}</dt>
                <dd>{estimate.prepaymentAmount || calculation.prepaymentAmount || "\u041d\u0435 \u0432\u043d\u0435\u0441\u0435\u043d\u0430"}</dd>
              </div>
              <div>
                <dt>{"\u0421\u0442\u0430\u0442\u0443\u0441 \u043f\u0440\u0435\u0434\u043e\u043f\u043b\u0430\u0442\u044b"}</dt>
                <dd>{calculation.prepaymentStatus || "\u041d\u0435 \u0437\u0430\u043f\u0440\u043e\u0448\u0435\u043d\u0430"}</dd>
              </div>
              <div>
                <dt>{"\u041e\u0441\u0442\u0430\u0442\u043e\u043a \u043a \u043e\u043f\u043b\u0430\u0442\u0435"}</dt>
                <dd>{estimate.balanceDue || calculation.balanceDue || "\u0423\u0442\u043e\u0447\u043d\u044f\u0435\u0442\u0441\u044f"}</dd>
              </div>
              <div>
                <dt>{"\u0424\u0438\u043d\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u043b\u0430\u0442\u0451\u0436"}</dt>
                <dd>{calculation.finalPaymentStatus || production.finalPaymentStatus || "\u041d\u0435 \u0437\u0430\u043f\u0440\u043e\u0448\u0435\u043d"}</dd>
              </div>
            </dl>
          </article>

          <article className="summary-card">
            <strong>{"\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0441\u043c\u0435\u0442\u044b"}</strong>
            <p>{estimateExport.sourceLabel || "\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0441\u043c\u0435\u0442\u044b \u043f\u043e\u043a\u0430 \u043d\u0435 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d"}</p>
            <dl>
              <div>
                <dt>{"\u0412\u0435\u0440\u0441\u0438\u044f"}</dt>
                <dd>{estimateExport.version || "\u0427\u0435\u0440\u043d\u043e\u0432\u0438\u043a"}</dd>
              </div>
              <div>
                <dt>{"\u0414\u0430\u0442\u0430 \u044d\u043a\u0441\u043f\u043e\u0440\u0442\u0430"}</dt>
                <dd>{estimateExport.exportedAt || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u0430"}</dd>
              </div>
              <div>
                <dt>{"\u041a\u0442\u043e \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u043b"}</dt>
                <dd>{estimateExport.uploadedBy || "\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d"}</dd>
              </div>
              <div>
                <dt>{"\u0427\u0442\u043e \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u043e"}</dt>
                <dd>{estimateExport.actuality || "\u041d\u0435 \u0437\u0430\u0434\u0430\u043d\u043e"}</dd>
              </div>
            </dl>
          </article>
        </div>

        <div className="compact-list" style={{ marginTop: 18 }}>
          {estimateItems.length ? (
            estimateItems.map((item) => (
              <article className="mini-item" key={item.id}>
                <div className="mini-item-head">
                  <strong>{item.title}</strong>
                  <span className="status-chip">{item.amount}</span>
                </div>
                <p className="compact-note">{item.dimensions}</p>
                <div className="mini-meta">
                  <span>{item.zone}</span>
                  <span>{formatOrderQuantity(item.quantity)}</span>
                  <span>{item.unitPrice}</span>
                </div>
                <div className="mini-meta">
                  <span>{item.material}</span>
                  <span>{item.facade}</span>
                  <span>{item.hardware}</span>
                </div>
                <p className="compact-note">{item.status}</p>
              </article>
            ))
          ) : (
            <article className="timeline-empty">
              {"\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0441\u043c\u0435\u0442\u043d\u043e\u0439 \u0440\u0430\u0437\u0431\u0438\u0432\u043a\u0438: \u0435\u0451 \u043d\u0443\u0436\u043d\u043e \u0441\u043e\u0431\u0440\u0430\u0442\u044c \u0438\u0437 \u0437\u0430\u043c\u0435\u0440\u0430, \u043f\u043e\u0437\u0438\u0446\u0438\u0439 \u0438 \u043c\u0430\u0442\u0435\u0440\u0438\u0430\u043b\u043e\u0432."}
            </article>
          )}
        </div>

        <div className="compact-list" style={{ marginTop: 18 }}>
          {estimatePaymentPlan.map((item) => (
            <article className="summary-card" key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.note}</p>
              <dl>
                <div>
                  <dt>{"\u0421\u0443\u043c\u043c\u0430"}</dt>
                  <dd>{item.amount}</dd>
                </div>
                <div>
                  <dt>{"\u0421\u0442\u0430\u0442\u0443\u0441"}</dt>
                  <dd>{item.status}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <div className="lead-anchor-shell" id="deal-project-editor">
          <LeadOrderContextForm
            initialCalculation={calculation}
            initialItems={orderItems}
            initialProject={project}
            slug={resolved.slug}
          />
        </div>
        <div className="lead-anchor-shell" id="deal-production-editor">
          <LeadProductionContextForm
            initialAddress={lead.address}
            initialInstallation={installation}
            initialProduction={production}
            slug={resolved.slug}
          />
        </div>
      </div>

      <section
        className="panel lead-section-anchor"
        id="deal-history"
        style={{ marginTop: 18 }}
      >
        <div className="section-title">
          <p className="eyebrow">История контакта</p>
          <h2>Что уже сказал клиент и как двигалась сделка</h2>
          <p>
            Вся ключевая переписка и действия команды собраны здесь, чтобы можно
            было быстро войти в контекст перед созвоном, расчётом или замером.
          </p>
        </div>

        <div className="timeline-list">
          {lead.messages.length ? (
            lead.messages.map((message, index) => (
              <article
                className={`timeline-item timeline-item-${message.direction}`}
                key={`${message.time}-${index}`}
              >
                <div className="timeline-head">
                  <strong>{message.sender}</strong>
                  <span>{message.time}</span>
                </div>
                <p>{message.text}</p>
              </article>
            ))
          ) : (
            <article className="timeline-empty">История сообщений пока не загружена.</article>
          )}
        </div>
      </section>

      <div className="lead-detail-grid lead-detail-grid-actions" id="deal-workflow">
        <div className="lead-anchor-shell">
          <ManagerOutcomeForm
            initialStatus={lead.status}
            requestTrack={lead.intakeSession?.requestTrack || null}
            slug={resolved.slug}
          />
        </div>
        <div className="lead-anchor-shell">
          <LeadWorkflowForm
            slug={resolved.slug}
            initialStatus={lead.status}
            initialNextAction={lead.nextAction}
            statusOptions={statusOptions}
          />
        </div>
      </div>

      <div className="lead-detail-grid lead-detail-grid-actions" id="deal-next-steps">
        <div className="lead-anchor-shell">
        <AppointmentCreateForm
          initialLead={lead.name}
          initialOwner={lead.manager}
          title="Назначить замер или консультацию"
          description="Используй этот блок, когда клиент уже готов к выезду, шоуруму или короткой консультации перед расчётом."
        />
        </div>
        <div className="lead-anchor-shell">
        <FollowupCreateForm
          initialLead={lead.name}
          initialOwner={lead.manager}
          title="Запланировать возврат к клиенту"
          description="Если по сделке нужен повторный контакт после расчёта, замера или КП, зафиксируй его сразу в карточке."
        />
        </div>
      </div>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <MiniListSection
          eyebrow="Состав заказа"
          title="Позиции проекта"
          emptyText="Состав мебели по проекту пока не заполнен."
          id="deal-order-items"
          items={orderItems}
          renderItem={(item) => (
            <article className="mini-item" key={item.id}>
              <div className="mini-item-head">
                <strong>{item.title}</strong>
                <span className="status-chip">{item.status}</span>
              </div>
              <p className="compact-note">{item.dimensions}</p>
              <div className="mini-meta">
                <span>{item.zone}</span>
                <span>{formatOrderQuantity(item.quantity)}</span>
                <span>{item.amount}</span>
              </div>
              <div className="mini-meta">
                <span>{item.material}</span>
                <span>{item.facade}</span>
                <span>{item.hardware}</span>
              </div>
            </article>
          )}
        />

        <MiniListSection
          eyebrow="После замера"
          title="Производственные этапы по заказу"
          emptyText="Производственный контур по заказу пока не собран."
          id="deal-production"
          items={productionStages}
          renderItem={(item) => (
            <article className="mini-item" key={item.title}>
              <div className="mini-item-head">
                <strong>{item.title}</strong>
                <span className="status-chip">{item.value}</span>
              </div>
              <p className="compact-note">{item.note}</p>
            </article>
          )}
        />
      </div>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <MiniListSection
          eyebrow="Задачи"
          title="Что нужно сделать по сделке"
          emptyText="Активных задач по сделке пока нет."
          id="deal-tasks"
          items={lead.tasks || []}
          renderItem={(task, index) => (
            <article className="mini-item" key={`${task.title}-${index}`}>
              <div className="mini-item-head">
                <strong>{task.title}</strong>
                <span className={`status-chip status-chip-${String(task.status).toLowerCase()}`}>
                  {formatTaskStatus(task.status)}
                </span>
              </div>
              <p className="compact-note">{task.description}</p>
              <div className="mini-meta">
                <span>{task.owner}</span>
                <span>{formatPriority(task.priority)}</span>
                <span>{task.dueAt}</span>
              </div>
              {task.status === "OPEN" ? <TaskCompleteButton title={task.title} /> : null}
            </article>
          )}
        />

        <MiniListSection
          eyebrow="Возврат"
          title="Запланированные возвраты"
          emptyText="Повторных контактов по сделке пока нет."
          id="deal-followups"
          items={lead.followups || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.type}-${item.scheduledAt}-${index}`}>
              <div className="mini-item-head">
                <strong>{item.type}</strong>
                <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
                  {formatFollowupStatus(item.status)}
                </span>
              </div>
              <p className="compact-note">{item.note}</p>
              <div className="mini-meta">
                <span>{item.owner}</span>
                <span>{item.scheduledAt}</span>
              </div>
              {item.status === "PENDING" ? (
                <FollowupCompleteButton
                  lead={lead.name}
                  scheduledAt={item.scheduledAt}
                  type={item.type}
                />
              ) : null}
            </article>
          )}
        />
      </div>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <MiniListSection
          eyebrow="Замеры"
          title="Встречи и выезды по сделке"
          emptyText="Замеры и консультации пока не назначены."
          id="deal-measurements"
          items={lead.appointments || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.id || index}`}>
              <div className="mini-item-head">
                <strong>{formatAppointmentType(item.type)}</strong>
                <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
                  {formatAppointmentStatus(item.status)}
                </span>
              </div>
              <p className="compact-note">{item.note}</p>
              <div className="mini-meta">
                <span>{item.measurer || item.owner}</span>
                <span>{item.scheduledAt}</span>
                <span>{item.address || item.location}</span>
              </div>
              <div className="mini-meta">
                <span>{item.duration}</span>
                <span>{item.dimensionsSummary || "Размеры будут после замера"}</span>
                {item.prepaymentAmount ? <span>{item.prepaymentAmount}</span> : null}
              </div>
              <p className="compact-note">{item.measurementResult || item.outcomeNote}</p>
              <AppointmentStatusForm id={item.id} status={item.status} />
            </article>
          )}
        />

        <MiniListSection
          eyebrow="Журнал"
          title="Последние действия по сделке"
          emptyText="Активность по сделке пока не зафиксирована."
          id="deal-journal"
          items={lead.activity || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.action}-${item.time}-${index}`}>
              <div className="mini-item-head">
                <strong>{item.action}</strong>
                <span>{item.time}</span>
              </div>
              <p className="compact-note">{item.actor}</p>
              <p className="compact-note">{item.detail}</p>
            </article>
          )}
        />
      </div>
    </main>
  );
}
