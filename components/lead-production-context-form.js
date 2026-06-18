"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";
import {
  INSTALLATION_STATUS_OPTIONS,
  PRODUCTION_STAGE_OPTIONS,
  normalizeStatusValue
} from "../lib/order-statuses";

function OptionSelect({ label, options, value, onChange, lang }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {pick(lang, item.en, item.ru)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function LeadProductionContextForm({
  slug,
  initialProduction = {},
  initialInstallation = {},
  initialAddress = "",
  lang = "en"
}) {
  const router = useRouter();
  const [handedToProduction, setHandedToProduction] = useState(
    Boolean(initialProduction.handedToProduction)
  );
  const [handoverDate, setHandoverDate] = useState(initialProduction.handoverDate || "");
  const [stage, setStage] = useState(
    normalizeStatusValue(PRODUCTION_STAGE_OPTIONS, initialProduction.stage, "awaiting-cutting")
  );
  const [stageOwner, setStageOwner] = useState(initialProduction.stageOwner || "");
  const [deadline, setDeadline] = useState(initialProduction.deadline || "");
  const [productionComment, setProductionComment] = useState(initialProduction.comment || "");
  const [installationDate, setInstallationDate] = useState(initialInstallation.date || "");
  const [installationAddress, setInstallationAddress] = useState(
    initialInstallation.address || initialAddress || ""
  );
  const [installer, setInstaller] = useState(initialInstallation.installer || "");
  const [installationStatus, setInstallationStatus] = useState(
    normalizeStatusValue(INSTALLATION_STATUS_OPTIONS, initialInstallation.status, "not-scheduled")
  );
  const [installationComment, setInstallationComment] = useState(initialInstallation.comment || "");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    try {
      const response = await fetch(`/api/leads/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          production: {
            handedToProduction,
            handoverDate,
            stage,
            stageOwner,
            deadline,
            comment: productionComment
          },
          installation: {
            date: installationDate,
            address: installationAddress,
            installer,
            status: installationStatus,
            comment: installationComment
          }
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || pick(lang, "Failed to save production context", "Не удалось сохранить производственный блок"));
      }

      setFeedback(pick(lang, "Production and installation saved", "Производство и установка сохранены"));
      router.refresh();
    } catch (error) {
      setFeedback(`${pick(lang, "Form error", "Ошибка формы")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel workflow-form-panel">
      <div className="section-title">
        <p className="eyebrow">{pick(lang, "Production and installation", "Производство и установка")}</p>
        <h2>{pick(lang, "Update production context", "Обновить производственный блок")}</h2>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="lead-detail-grid" style={{ marginTop: 0 }}>
          <label className="field-block">
            <span>{pick(lang, "Sent to production", "Передано в производство")}</span>
            <select
              value={handedToProduction ? "yes" : "no"}
              onChange={(event) => setHandedToProduction(event.target.value === "yes")}
            >
              <option value="yes">{pick(lang, "Yes", "Да")}</option>
              <option value="no">{pick(lang, "No", "Нет")}</option>
            </select>
          </label>

          <label className="field-block">
            <span>{pick(lang, "Handover date", "Дата передачи")}</span>
            <input
              type="text"
              value={handoverDate}
              onChange={(event) => setHandoverDate(event.target.value)}
              placeholder={pick(lang, "For example: Today, 18:20", "Например: Сегодня, 18:20")}
            />
          </label>

          <OptionSelect
            label={pick(lang, "Production stage", "Этап производства")}
            options={PRODUCTION_STAGE_OPTIONS}
            value={stage}
            onChange={setStage}
            lang={lang}
          />

          <label className="field-block">
            <span>{pick(lang, "Stage owner", "Ответственный этап")}</span>
            <input
              type="text"
              value={stageOwner}
              onChange={(event) => setStageOwner(event.target.value)}
              placeholder={pick(lang, "Manager, workshop, installer...", "Менеджер, цех, монтажник...")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Deadline", "Дедлайн")}</span>
            <input
              type="text"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              placeholder={pick(lang, "For example: Friday / 14 June", "Например: Пятница / 14 июня")}
            />
          </label>

          <OptionSelect
            label={pick(lang, "Installation status", "Статус установки")}
            options={INSTALLATION_STATUS_OPTIONS}
            value={installationStatus}
            onChange={setInstallationStatus}
            lang={lang}
          />

          <label className="field-block">
            <span>{pick(lang, "Installation date", "Дата установки")}</span>
            <input
              type="text"
              value={installationDate}
              onChange={(event) => setInstallationDate(event.target.value)}
              placeholder={pick(lang, "For example: 22 June, 10:00", "Например: 22 июня, 10:00")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Installer", "Монтажник")}</span>
            <input
              type="text"
              value={installer}
              onChange={(event) => setInstaller(event.target.value)}
              placeholder={pick(lang, "Installer name", "Имя монтажника")}
            />
          </label>
        </div>

        <label className="field-block">
          <span>{pick(lang, "Installation address", "Адрес установки")}</span>
          <textarea
            rows={3}
            value={installationAddress}
            onChange={(event) => setInstallationAddress(event.target.value)}
            placeholder={pick(
              lang,
              "Full site address with entrance, floor and access notes.",
              "Полный адрес объекта с подъездом, этажом и важными примечаниями."
            )}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Production note", "Комментарий производства")}</span>
          <textarea
            rows={4}
            value={productionComment}
            onChange={(event) => setProductionComment(event.target.value)}
            placeholder={pick(
              lang,
              "What the workshop is waiting for, bottlenecks, or what is already confirmed.",
              "Что ждём от цеха, где узкое место и что уже подтверждено."
            )}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Installation note", "Комментарий по установке")}</span>
          <textarea
            rows={4}
            value={installationComment}
            onChange={(event) => setInstallationComment(event.target.value)}
            placeholder={pick(
              lang,
              "Anything the installer should know before arriving on site.",
              "Что монтажнику нужно знать до выезда на объект."
            )}
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save production context", "Сохранить производственный блок")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
