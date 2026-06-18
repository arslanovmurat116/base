import Link from "next/link";
import { notFound } from "next/navigation";
import AppointmentCreateForm from "../../../components/appointment-create-form";
import AppointmentStatusForm from "../../../components/appointment-status-form";
import FollowupCompleteButton from "../../../components/followup-complete-button";
import FollowupCreateForm from "../../../components/followup-create-form";
import LeadOrderContextForm from "../../../components/lead-order-context-form";
import LeadProjectFileDeleteButton from "../../../components/lead-project-file-delete-button";
import LeadProjectFilesForm from "../../../components/lead-project-files-form";
import LeadProductionContextForm from "../../../components/lead-production-context-form";
import LeadWorkflowForm from "../../../components/lead-workflow-form";
import ManagerOutcomeForm from "../../../components/manager-outcome-form";
import TaskCompleteButton from "../../../components/task-complete-button";
import {
  translateAmountText,
  translateDurationText,
  translateEstimateLabel,
  translateExportLabel,
  safeLocalizedText,
  translateCalculationStatus,
  translateChannel,
  translateDealStage,
  translateFollowupType,
  translateMeasurementStatus,
  translateNextStepText,
  translateProduct,
  translateProductionStage,
  translateRequestType,
  translateScheduleText,
  translateSource,
  translateTag,
  translateTaskDescription,
  translateTaskTitle,
  translateLocationText,
  translateUrgency
} from "../../../lib/display-text";
import { pick } from "../../../lib/i18n";
import { getLanguage } from "../../../lib/i18n-server";
import {
  FINAL_PAYMENT_STATUS_OPTIONS,
  INSTALLATION_STATUS_OPTIONS,
  PREPAYMENT_STATUS_OPTIONS,
  PRODUCTION_STAGE_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  formatStatusValue
} from "../../../lib/order-statuses";
import { getLeadBySlug, getLeadStatusOptions } from "../../../lib/server-data";

const PROJECT_FILE_COPY = {
  render: ["Project render", "Рендер проекта"],
  model: ["3D model", "3D-модель"],
  drawings: ["Drawings", "Чертежи"],
  "estimate-preview": ["Estimate preview", "Превью сметы"],
  "source-project": ["Source project", "Исходник проекта"],
  "estimate-excel": ["Estimate Excel", "Смета Excel"],
  "drawings-pdf": ["Drawings PDF", "PDF чертежей"]
};

function fileSlotTitle(slotId, fallbackTitle, lang) {
  const copy = PROJECT_FILE_COPY[slotId];
  return copy ? pick(lang, copy[0], copy[1]) : fallbackTitle || slotId;
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
      return pick(lang, "Deposit / production", "Предоплата / производство");
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

function formatTaskStatus(status, lang) {
  switch (status) {
    case "OPEN":
      return pick(lang, "Open", "Открыта");
    case "DONE":
      return pick(lang, "Done", "Закрыта");
    default:
      return status;
  }
}

function formatFollowupStatus(status, lang) {
  switch (status) {
    case "PENDING":
      return pick(lang, "Pending", "Запланирован");
    case "DONE":
      return pick(lang, "Done", "Выполнен");
    default:
      return status;
  }
}

function formatRequestTrack(track, lang) {
  switch (track) {
    case "booking":
      return pick(lang, "Measurement / visit", "Замер / выезд");
    case "estimate":
      return pick(lang, "Estimate", "Расчёт");
    case "consultation":
      return pick(lang, "Consultation", "Консультация");
    case "explore":
      return pick(lang, "Exploration", "Подогрев");
    default:
      return pick(lang, "General", "Общий поток");
  }
}

function formatPriority(priority, lang) {
  switch (priority) {
    case "high":
      return pick(lang, "High priority", "Высокий приоритет");
    case "medium":
      return pick(lang, "Medium priority", "Средний приоритет");
    case "low":
      return pick(lang, "Low priority", "Низкий приоритет");
    default:
      return priority || pick(lang, "No priority", "Без приоритета");
  }
}

function formatOrderQuantity(value, lang) {
  const numeric = Number(value || 0);

  if (!numeric || Number.isNaN(numeric)) {
    return pick(lang, "1 pc", "1 шт.");
  }

  return pick(lang, `${numeric} pcs`, `${numeric} шт.`);
}

function yesNo(value, lang) {
  return value ? pick(lang, "Yes", "Да") : pick(lang, "No", "Нет");
}

function DetailCard({ label, value }) {
  return (
    <article className="detail-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SectionHeader({ eyebrow, title, note }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function MiniListSection({ id, eyebrow, title, emptyText, items, renderItem }) {
  return (
    <section className="panel lead-section-anchor" id={id}>
      <SectionHeader eyebrow={eyebrow} title={title} />
      <div className="compact-list">
        {items.length ? items.map(renderItem) : <article className="timeline-empty">{emptyText}</article>}
      </div>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const resolved = await params;
  const lead = await getLeadBySlug(resolved.slug);

  return {
    title: lead ? `${lead.name} | Deal` : "Deal not found | Furneq"
  };
}

export default async function LeadDetailPage({ params }) {
  const resolved = await params;
  const lang = await getLanguage();
  const lead = await getLeadBySlug(resolved.slug);

  if (!lead) {
    notFound();
  }

  const statusOptions = getLeadStatusOptions();
  const nextAppointment = [...(lead.appointments || [])]
    .filter((item) => ["SCHEDULED", "CONFIRMED"].includes(String(item.status)))
    .sort((first, second) => {
      const firstDate = first.scheduledAtIso ? new Date(first.scheduledAtIso).getTime() : Number.MAX_SAFE_INTEGER;
      const secondDate = second.scheduledAtIso ? new Date(second.scheduledAtIso).getTime() : Number.MAX_SAFE_INTEGER;
      return firstDate - secondDate;
    })[0];
  const nextFollowup = (lead.followups || []).find((item) => String(item.status) === "PENDING");
  const openTasksCount = (lead.tasks || []).filter((item) => String(item.status) === "OPEN").length;
  const project = lead.project || {};
  const calculation = lead.order?.calculation || lead.postMeasurementCard?.calculation || {};
  const estimate = lead.order?.estimate || {};
  const production = lead.order?.production || lead.postMeasurementCard?.production || {};
  const installation = lead.order?.installation || lead.postMeasurementCard?.installation || {};
  const projectAssets = lead.projectAssets || project.assets || {};
  const projectFiles = projectAssets.files || [];
  const projectPreviews = projectAssets.previews || [];
  const estimateExport = estimate.export || projectAssets.estimate || {};
  const orderItems = lead.order?.items || [];
  const estimateItems = estimate.items || [];
  const estimatePaymentPlan = estimate.paymentPlan || [];
  const projectStatus = formatStatusValue(PROJECT_STATUS_OPTIONS, project.status, lang, pick(lang, "Draft", "Черновик"));
  const depositStatus = formatStatusValue(PREPAYMENT_STATUS_OPTIONS, calculation.prepaymentStatus || lead.prepaymentStatus, lang, pick(lang, "Not requested", "Не запрошена"));
  const finalPaymentStatus = formatStatusValue(FINAL_PAYMENT_STATUS_OPTIONS, calculation.finalPaymentStatus || production.finalPaymentStatus, lang, pick(lang, "Not requested", "Не запрошена"));
  const productionStage = formatStatusValue(PRODUCTION_STAGE_OPTIONS, production.stage, lang, pick(lang, "Not started", "Не запущено"));
  const installationStatus = formatStatusValue(INSTALLATION_STATUS_OPTIONS, installation.status, lang, pick(lang, "Not scheduled", "Не назначена"));
  const productionStageLabel = translateProductionStage(productionStage, lang);
  const dealStageLabel = translateDealStage(lead.dealStage || lead.status, lang);
  const productLabel = translateProduct(lead.product, lang);
  const requestLabel = translateRequestType(lead.requestType, lang);
  const calculationLabel = translateCalculationStatus(lead.calculationStatus, lang);
  const urgencyLabel = translateUrgency(lead.urgency, lang);
  const measurementLabel = translateMeasurementStatus(lead.measurementStatus, lang);

  const quickSections = [
    {
      href: "#deal-summary",
      label: pick(lang, "Summary", "Сводка"),
      value: dealStageLabel,
      note: translateNextStepText(
        lead.nextAction || lead.nextContactAt || lead.deadline,
        lang,
        "Open the deal card to review the next step.",
        "Следующий шаг не зафиксирован"
      )
    },
    {
      href: "#deal-project",
      label: pick(lang, "Project", "Проект"),
      value: projectStatus,
      note: translateAmountText(calculation.finalAmount || lead.estimateRange, lang, "Amount pending", "Сумма уточняется")
    },
    {
      href: "#deal-project-files",
      label: pick(lang, "Files", "Файлы"),
      value: String(projectFiles.length + projectPreviews.length),
      note: translateExportLabel(estimateExport.version, lang)
    },
    {
      href: "#deal-estimate",
      label: pick(lang, "Estimate", "Смета"),
      value: translateAmountText(estimate.finalAmount || calculation.finalAmount, lang, "Pending", "Уточняется"),
      note: depositStatus
    },
    {
      href: "#deal-production",
      label: pick(lang, "Production", "Производство"),
      value: productionStageLabel,
      note: translateScheduleText(production.deadline, lang, "No deadline", "Дедлайн не назначен")
    },
    {
      href: "#deal-measurements",
      label: pick(lang, "Appointments", "Замеры"),
      value: measurementLabel,
      note: nextAppointment?.scheduledAt
        ? translateScheduleText(nextAppointment.scheduledAt, lang, "No upcoming visit", "Следующего выезда пока нет")
        : pick(lang, "No upcoming visit", "Следующего выезда пока нет")
    }
  ];

  return (
    <main className="page-shell">
      <section className="page-heading">
        <p className="eyebrow">{pick(lang, "Deal", "Сделка")}</p>
        <h1>{lead.name}</h1>
        <p>
          {translateNextStepText(
            lead.nextAction || lead.summary || lead.nextContactAt,
            lang,
            "Open the order card to review the current next step.",
            "Откройте карточку заказа, чтобы посмотреть текущий следующий шаг."
          )}
        </p>
      </section>

      <section className="lead-quick-nav" aria-label={pick(lang, "Deal quick navigation", "Быстрая навигация по сделке")}>
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
            <span className="badge-soft">{translateChannel(lead.channel, lang)}</span>
            <span className="badge-soft">{translateSource(lead.source, lang)}</span>
            <span className="badge-soft">{dealStageLabel}</span>
          </div>

          <h2 className="lead-title">{productLabel || pick(lang, "Custom furniture order", "Заказ на мебель")}</h2>
          {lead.tags?.length ? (
            <div className="chip-row">
              {lead.tags.map((tag) => (
                <span className="chip-strong" key={tag}>
                  {translateTag(tag, lang)}
                </span>
              ))}
            </div>
          ) : null}

          <div className="detail-grid">
            <DetailCard label={pick(lang, "Product", "Изделие")} value={productLabel || pick(lang, "Not set", "Не указано")} />
            <DetailCard label={pick(lang, "Request", "Запрос")} value={requestLabel || pick(lang, "Not set", "Не указан")} />
            <DetailCard label={pick(lang, "Budget", "Бюджет")} value={translateAmountText(lead.budget, lang, "Pending", "Уточняется")} />
            <DetailCard label={pick(lang, "Estimate status", "Статус расчёта")} value={calculationLabel} />
            <DetailCard label={pick(lang, "Manager", "Ответственный")} value={lead.manager || pick(lang, "Unassigned", "Не назначен")} />
            <DetailCard label={pick(lang, "Address", "Адрес")} value={lead.address || lead.city || pick(lang, "Not set", "Не указан")} />
            <DetailCard label={pick(lang, "Urgency", "Срочность")} value={urgencyLabel} />
            <DetailCard
              label={pick(lang, "Next contact", "Следующий контакт")}
              value={translateScheduleText(lead.nextContactAt, lang, "Not scheduled", "Не назначен")}
            />
            <DetailCard label={pick(lang, "Deposit status", "Статус предоплаты")} value={depositStatus} />
            <DetailCard label={pick(lang, "Deposit", "Предоплата")} value={translateAmountText(lead.prepaymentAmount || calculation.prepaymentAmount, lang, "None yet", "Не внесена")} />
            <DetailCard label={pick(lang, "Final amount", "Итоговая сумма")} value={translateAmountText(lead.finalAmount || calculation.finalAmount || lead.estimateRange, lang, "Pending", "Уточняется")} />
            <DetailCard
              label={pick(lang, "Next step", "Следующий шаг")}
              value={safeLocalizedText(lead.nextAction, lang, "Open the order card", "Не зафиксирован")}
            />
          </div>

          <div className="lead-action-bar">
            <Link className="ghost-link" href="/leads">
              {pick(lang, "Back to deals", "Вернуться к сделкам")}
            </Link>
            <Link className="primary-link" href="/appointments">
              {pick(lang, "Open appointments", "Открыть замеры")}
            </Link>
          </div>
        </section>

        <section className="panel lead-section-anchor" id="deal-project">
          <SectionHeader
            eyebrow={pick(lang, "Project", "Проект")}
            title={pick(lang, "Order context", "Контекст заказа")}
            note={pick(lang, "Project, estimate, production and installation live in one place.", "Проект, смета, производство и установка собраны в одной карточке.")}
          />

          <div className="compact-list">
            <article className="summary-card">
              <strong>{pick(lang, "Project", "Проект")}</strong>
              <p>
                {safeLocalizedText(
                  project.description || project.layout || lead.projectSize,
                  lang,
                  "Project details are being prepared in the order card.",
                  "Детали проекта ещё собираются."
                )}
              </p>
              <dl>
                <div>
                  <dt>{pick(lang, "Status", "Статус")}</dt>
                  <dd>{projectStatus}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Materials", "Материалы")}</dt>
                  <dd>{safeLocalizedText(project.materials, lang, "Pending", "Уточняются")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Hardware", "Фурнитура")}</dt>
                  <dd>{safeLocalizedText(project.hardware, lang, "Pending", "Уточняется")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Prepared at", "Подготовлено")}</dt>
                  <dd>{translateScheduleText(project.preparedAt, lang, "Not set", "Не указано")}</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card" id="deal-estimate">
              <strong>{pick(lang, "Estimate", "Смета")}</strong>
              <p>{translateEstimateLabel(estimate.versionLabel || estimate.status || lead.calculationStatus, lang)}</p>
              <dl>
                <div>
                  <dt>{pick(lang, "Preliminary amount", "Предварительная сумма")}</dt>
                  <dd>{translateAmountText(estimate.preliminaryAmount || calculation.preliminaryAmount || lead.order?.estimateRange, lang, "Pending", "Уточняется")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Final amount", "Итоговая сумма")}</dt>
                  <dd>{translateAmountText(estimate.finalAmount || calculation.finalAmount || lead.finalAmount, lang, "Pending", "Уточняется")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Deposit amount", "Сумма предоплаты")}</dt>
                  <dd>{translateAmountText(estimate.prepaymentAmount || calculation.prepaymentAmount, lang, "None yet", "Не внесена")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Balance due", "Остаток к оплате")}</dt>
                  <dd>{translateAmountText(estimate.balanceDue || calculation.balanceDue, lang, "Pending", "Уточняется")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Deposit status", "Статус предоплаты")}</dt>
                  <dd>{depositStatus}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Final payment", "Финальная оплата")}</dt>
                  <dd>{finalPaymentStatus}</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card" id="deal-production">
              <strong>{pick(lang, "Production", "Производство")}</strong>
              <p>{safeLocalizedText(production.overall, lang, productionStageLabel, productionStageLabel)}</p>
              <dl>
                <div>
                  <dt>{pick(lang, "Sent to production", "Передано в производство")}</dt>
                  <dd>{yesNo(production.handedToProduction, lang)}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Handover date", "Дата передачи")}</dt>
                  <dd>{safeLocalizedText(production.handoverDate, lang, "Not sent", "Не передано")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Stage", "Этап")}</dt>
                  <dd>{productionStageLabel}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Owner", "Ответственный")}</dt>
                  <dd>{production.stageOwner || pick(lang, "Unassigned", "Не назначен")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Deadline", "Дедлайн")}</dt>
                  <dd>{translateScheduleText(production.deadline, lang, "Not set", "Не назначен")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Production note", "Комментарий производства")}</dt>
                  <dd>{safeLocalizedText(production.comment, lang, "No note yet", "Пока не добавлен")}</dd>
                </div>
              </dl>
            </article>

            <article className="summary-card">
              <strong>{pick(lang, "Installation", "Установка")}</strong>
              <p>{installationStatus}</p>
              <dl>
                <div>
                  <dt>{pick(lang, "Installation date", "Дата установки")}</dt>
                  <dd>{translateScheduleText(installation.date, lang, "Not scheduled", "Не назначена")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Address", "Адрес")}</dt>
                  <dd>{installation.address || lead.address || pick(lang, "Not set", "Не указан")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Installer", "Монтажник")}</dt>
                  <dd>{installation.installer || pick(lang, "Unassigned", "Не назначен")}</dd>
                </div>
                <div>
                  <dt>{pick(lang, "Status", "Статус")}</dt>
                  <dd>{installationStatus}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
      </div>

      <div className="lead-detail-grid">
        <section className="panel lead-section-anchor" id="deal-project-preview">
          <SectionHeader eyebrow={pick(lang, "Preview", "Превью")} title={pick(lang, "Project previews", "Превью проекта")} />
          <div className="compact-list">
            {projectPreviews.length ? (
              projectPreviews.map((item) => (
                <article className="summary-card" key={item.id || item.url}>
                  <strong>{fileSlotTitle(item.slotId, item.title, lang)}</strong>
                  <p>{safeLocalizedText(item.note, lang, item.fileName || item.url, item.fileName || item.url)}</p>
                  {item.url ? (
                    <a className="ghost-link" href={item.url} rel="noreferrer" target="_blank">
                      {pick(lang, "Open file", "Открыть файл")}
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <article className="timeline-empty">{pick(lang, "No previews attached yet.", "Превью проекта пока не добавлены.")}</article>
            )}
          </div>
        </section>

        <section className="panel lead-section-anchor" id="deal-project-files">
          <SectionHeader eyebrow={pick(lang, "Files", "Файлы")} title={pick(lang, "Project files", "Файлы проекта")} />
          <div className="compact-list">
            {projectFiles.length ? (
              projectFiles.map((item) => (
                <article className="summary-card" key={item.id || item.url}>
                  <div className="mini-item-head">
                    <strong>{fileSlotTitle(item.slotId, item.title, lang)}</strong>
                    <LeadProjectFileDeleteButton
                      filePath={item.storagePath || item.filePath}
                      lang={lang}
                      slug={resolved.slug}
                      title={fileSlotTitle(item.slotId, item.title, lang)}
                    />
                  </div>
                  <p>{item.fileName || item.url}</p>
                  <div className="mini-meta">
                    {item.version ? <span>{item.version}</span> : null}
                    {item.exportedAt ? <span>{item.exportedAt}</span> : null}
                    {item.uploadedBy ? <span>{item.uploadedBy}</span> : null}
                  </div>
                  {item.url ? (
                    <a className="ghost-link" href={item.url} rel="noreferrer" target="_blank">
                      {pick(lang, "Open file", "Открыть файл")}
                    </a>
                  ) : null}
                </article>
              ))
            ) : (
              <article className="timeline-empty">{pick(lang, "No project files attached yet.", "Файлы проекта пока не добавлены.")}</article>
            )}
          </div>

          <div className="lead-anchor-shell" style={{ marginTop: 18 }}>
            <LeadProjectFilesForm
              initialEstimateExport={estimateExport}
              initialProjectAssets={projectAssets}
              lang={lang}
              managerName={lead.manager}
              slug={resolved.slug}
            />
          </div>
        </section>
      </div>

      <section className="panel lead-section-anchor" id="deal-estimate-details" style={{ marginTop: 18 }}>
        <SectionHeader eyebrow={pick(lang, "Estimate", "Смета")} title={pick(lang, "Estimate lines and payments", "Позиции сметы и платежи")} />

        <div className="compact-list">
          {estimateItems.length ? (
            estimateItems.map((item) => (
              <article className="mini-item" key={item.id}>
                <div className="mini-item-head">
                  <strong>{safeLocalizedText(item.title, lang, "Estimate line", "Позиция сметы")}</strong>
                  <span className="status-chip">{translateAmountText(item.amount, lang, item.amount, item.amount)}</span>
                </div>
                <p className="compact-note">{safeLocalizedText(item.dimensions, lang, "Open the deal card to review dimensions.", "Откройте сделку, чтобы посмотреть размеры.")}</p>
                <div className="mini-meta">
                  <span>{safeLocalizedText(item.zone, lang, "Order zone", "Зона заказа")}</span>
                  <span>{formatOrderQuantity(item.quantity, lang)}</span>
                  <span>{translateAmountText(item.unitPrice, lang, item.unitPrice, item.unitPrice)}</span>
                </div>
                <div className="mini-meta">
                  <span>{safeLocalizedText(item.material, lang, "Material pending", "Материал уточняется")}</span>
                  <span>{safeLocalizedText(item.facade, lang, "Facade pending", "Фасад уточняется")}</span>
                  <span>{safeLocalizedText(item.hardware, lang, "Hardware pending", "Фурнитура уточняется")}</span>
                </div>
                <p className="compact-note">{safeLocalizedText(item.status, lang, "Open the order card to review the line status.", "Откройте карточку заказа, чтобы посмотреть статус позиции.")}</p>
              </article>
            ))
          ) : (
            <article className="timeline-empty">{pick(lang, "Estimate positions are not filled yet.", "Позиции сметы пока не заполнены.")}</article>
          )}
        </div>

        {estimatePaymentPlan.length ? (
          <div className="compact-list" style={{ marginTop: 18 }}>
            {estimatePaymentPlan.map((item) => (
              <article className="summary-card" key={item.title}>
                <strong>{safeLocalizedText(item.title, lang, "Payment step", "Шаг оплаты")}</strong>
                <p>{safeLocalizedText(item.note, lang, "Open the order card to review payment details.", "Откройте карточку заказа, чтобы посмотреть детали оплаты.")}</p>
                <dl>
                  <div>
                    <dt>{pick(lang, "Amount", "Сумма")}</dt>
                    <dd>{translateAmountText(item.amount, lang, item.amount, item.amount)}</dd>
                  </div>
                  <div>
                    <dt>{pick(lang, "Status", "Статус")}</dt>
                    <dd>{safeLocalizedText(item.status, lang, "Pending", "Уточняется")}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <div className="lead-anchor-shell" id="deal-project-editor">
          <LeadOrderContextForm
            initialCalculation={calculation}
            initialItems={orderItems}
            initialProject={project}
            lang={lang}
            slug={resolved.slug}
          />
        </div>
        <div className="lead-anchor-shell" id="deal-production-editor">
          <LeadProductionContextForm
            initialAddress={lead.address}
            initialInstallation={installation}
            initialProduction={production}
            lang={lang}
            slug={resolved.slug}
          />
        </div>
      </div>

      <section className="panel lead-section-anchor" id="deal-history" style={{ marginTop: 18 }}>
        <SectionHeader eyebrow={pick(lang, "History", "История")} title={pick(lang, "Messages and timeline", "Сообщения и история")} />
        <div className="timeline-list">
          {lead.messages.length ? (
            lead.messages.map((message, index) => (
              <article
                className={`timeline-item timeline-item-${message.direction}`}
                key={`${message.time}-${index}`}
              >
                <div className="timeline-head">
                  <strong>
                    {message.sender === "Клиент"
                      ? pick(lang, "Client", "Клиент")
                      : message.sender === "Система"
                        ? pick(lang, "System", "Система")
                        : message.sender}
                  </strong>
                  <span>{translateScheduleText(message.time, lang, message.time, message.time)}</span>
                </div>
                <p>
                  {safeLocalizedText(
                    message.text,
                    lang,
                    "Open the deal card to review the message history.",
                    "Откройте карточку сделки, чтобы посмотреть историю сообщений."
                  )}
                </p>
              </article>
            ))
          ) : (
            <article className="timeline-empty">{pick(lang, "Message history is not loaded yet.", "История сообщений пока не загружена.")}</article>
          )}
        </div>
      </section>

      <div className="lead-detail-grid lead-detail-grid-actions" id="deal-workflow">
        <div className="lead-anchor-shell">
          <ManagerOutcomeForm
            initialStatus={lead.status}
            lang={lang}
            requestTrack={lead.intakeSession?.requestTrack || null}
            slug={resolved.slug}
          />
        </div>
        <div className="lead-anchor-shell">
          <LeadWorkflowForm
            lang={lang}
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
            description={pick(
              lang,
              "Book the next measurement, showroom visit or consultation.",
              "Назначь следующий замер, шоурум или консультацию."
            )}
            initialLead={lead.name}
            initialOwner={lead.manager}
            lang={lang}
            title={pick(lang, "Book appointment", "Назначить встречу")}
          />
        </div>
        <div className="lead-anchor-shell">
          <FollowupCreateForm
            description={pick(
              lang,
              "Set the next callback right away if the deal should not go cold.",
              "Поставь следующий возврат сразу, чтобы сделка не остыла."
            )}
            initialLead={lead.name}
            initialOwner={lead.manager}
            lang={lang}
            title={pick(lang, "Create follow-up", "Создать возврат")}
          />
        </div>
      </div>

      <div className="lead-detail-grid lead-detail-grid-actions">
        <MiniListSection
          eyebrow={pick(lang, "Tasks", "Задачи")}
          title={pick(lang, "Open tasks", "Открытые задачи")}
          emptyText={pick(lang, "No active tasks for this deal.", "Активных задач по сделке пока нет.")}
          id="deal-tasks"
          items={lead.tasks || []}
          renderItem={(task, index) => (
            <article className="mini-item" key={`${task.title}-${index}`}>
              <div className="mini-item-head">
                <strong>{translateTaskTitle(task.title, lang)}</strong>
                <span className={`status-chip status-chip-${String(task.status).toLowerCase()}`}>
                  {formatTaskStatus(task.status, lang)}
                </span>
              </div>
              <p className="compact-note">{translateTaskDescription(task.description, lang)}</p>
              <div className="mini-meta">
                <span>{task.owner}</span>
                <span>{formatPriority(task.priority, lang)}</span>
                <span>{translateScheduleText(task.dueAt, lang, "Not scheduled", "Не назначено")}</span>
              </div>
              {task.status === "OPEN" ? <TaskCompleteButton lang={lang} title={task.title} /> : null}
            </article>
          )}
        />

        <MiniListSection
          eyebrow={pick(lang, "Follow-ups", "Возвраты")}
          title={pick(lang, "Planned follow-ups", "Запланированные возвраты")}
          emptyText={pick(lang, "No follow-ups for this deal yet.", "Повторных контактов по сделке пока нет.")}
          id="deal-followups"
          items={lead.followups || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.type}-${item.scheduledAt}-${index}`}>
              <div className="mini-item-head">
                <strong>{translateFollowupType(item.type, lang)}</strong>
                <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
                  {formatFollowupStatus(item.status, lang)}
                </span>
              </div>
              <p className="compact-note">
                {safeLocalizedText(
                  item.note,
                  lang,
                  "Open the deal card to review the follow-up details.",
                  "Откройте карточку сделки, чтобы посмотреть детали возврата."
                )}
              </p>
              <div className="mini-meta">
                <span>{item.owner}</span>
                <span>{translateScheduleText(item.scheduledAt, lang, "Not scheduled", "Не назначено")}</span>
              </div>
              {item.status === "PENDING" ? (
                <FollowupCompleteButton
                  lang={lang}
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
          eyebrow={pick(lang, "Appointments", "Замеры")}
          title={pick(lang, "Visits and consultations", "Встречи и выезды")}
          emptyText={pick(lang, "No appointments for this deal yet.", "Замеры и консультации пока не назначены.")}
          id="deal-measurements"
          items={lead.appointments || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.id || index}`}>
              <div className="mini-item-head">
                <strong>{formatAppointmentType(item.type, lang)}</strong>
                <span className={`status-chip status-chip-${String(item.status).toLowerCase()}`}>
                  {formatAppointmentStatus(item.status, lang)}
                </span>
              </div>
              <p className="compact-note">
                {safeLocalizedText(
                  item.note,
                  lang,
                  "Open the deal card to review the visit details.",
                  "Откройте карточку сделки, чтобы посмотреть детали выезда."
                )}
              </p>
              <div className="mini-meta">
                <span>{item.measurer || item.owner}</span>
                <span>{translateScheduleText(item.scheduledAt, lang, "Not scheduled", "Не назначено")}</span>
                <span>{item.address || item.location}</span>
              </div>
              <div className="mini-meta">
                <span>{translateDurationText(item.duration, lang, item.duration, item.duration)}</span>
                <span>
                  {safeLocalizedText(
                    item.dimensionsSummary,
                    lang,
                    "Dimensions will be added after the visit.",
                    "Размеры будут после замера"
                  )}
                </span>
                {item.prepaymentAmount ? <span>{item.prepaymentAmount}</span> : null}
              </div>
              <p className="compact-note">
                {safeLocalizedText(
                  item.measurementResult || item.outcomeNote,
                  lang,
                  "Open the deal card to review the measurement result.",
                  "Откройте карточку сделки, чтобы посмотреть результат замера."
                )}
              </p>
              <AppointmentStatusForm id={item.id} lang={lang} status={item.status} />
            </article>
          )}
        />

        <MiniListSection
          eyebrow={pick(lang, "Journal", "Журнал")}
          title={pick(lang, "Recent activity", "Последние действия")}
          emptyText={pick(lang, "No activity recorded yet.", "Активность по сделке пока не зафиксирована.")}
          id="deal-journal"
          items={lead.activity || []}
          renderItem={(item, index) => (
            <article className="mini-item" key={`${item.action}-${item.time}-${index}`}>
              <div className="mini-item-head">
                <strong>{safeLocalizedText(item.action, lang, "Activity", "Действие")}</strong>
                <span>{translateScheduleText(item.time, lang, item.time, item.time)}</span>
              </div>
              <p className="compact-note">{item.actor}</p>
              <p className="compact-note">
                {safeLocalizedText(
                  item.detail,
                  lang,
                  "Open the deal card to review the latest activity.",
                  "Откройте карточку сделки, чтобы посмотреть детали активности."
                )}
              </p>
            </article>
          )}
        />
      </div>
    </main>
  );
}
