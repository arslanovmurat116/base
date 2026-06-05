"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PRODUCTION_STAGE_OPTIONS = [
  "Ожидает распил",
  "Распил",
  "Сборка",
  "Готово к установке",
  "Установка",
  "Завершено"
];

const INSTALLATION_STATUS_OPTIONS = [
  "Не назначена",
  "Готово к монтажу",
  "В установке",
  "Установка завершена"
];

function withCurrentValue(options, value) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

export default function LeadProductionContextForm({
  slug,
  initialProduction = {},
  initialInstallation = {},
  initialAddress = ""
}) {
  const router = useRouter();
  const [handedToProduction, setHandedToProduction] = useState(
    Boolean(initialProduction.handedToProduction)
  );
  const [handoverDate, setHandoverDate] = useState(initialProduction.handoverDate || "");
  const [stage, setStage] = useState(initialProduction.stage || "Ожидает распил");
  const [stageOwner, setStageOwner] = useState(initialProduction.stageOwner || "");
  const [deadline, setDeadline] = useState(initialProduction.deadline || "");
  const [productionComment, setProductionComment] = useState(initialProduction.comment || "");
  const [installationDate, setInstallationDate] = useState(initialInstallation.date || "");
  const [installationAddress, setInstallationAddress] = useState(
    initialInstallation.address || initialAddress || ""
  );
  const [installer, setInstaller] = useState(initialInstallation.installer || "");
  const [installationStatus, setInstallationStatus] = useState(
    initialInstallation.status || "Не назначена"
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

      const result = await response.json();
      setFeedback(result.message || "Производство и установка сохранены");

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка формы: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  const productionStageOptions = withCurrentValue(PRODUCTION_STAGE_OPTIONS, stage);
  const installationStatusOptions = withCurrentValue(
    INSTALLATION_STATUS_OPTIONS,
    installationStatus
  );

  return (
    <section className="panel workflow-form-panel">
      <div className="section-title">
        <p className="eyebrow">Производство и установка</p>
        <h2>Обновить производственный контур</h2>
        <p>
          Этот блок нужен, чтобы заказ не выпадал из контроля после предоплаты:
          кто держит этап, когда передали в цех и что уже известно по монтажу.
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="lead-detail-grid" style={{ marginTop: 0 }}>
          <label className="field-block">
            <span>Передано в производство</span>
            <select
              value={handedToProduction ? "yes" : "no"}
              onChange={(event) => setHandedToProduction(event.target.value === "yes")}
            >
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </label>

          <label className="field-block">
            <span>Дата передачи</span>
            <input
              type="text"
              value={handoverDate}
              onChange={(event) => setHandoverDate(event.target.value)}
              placeholder="Например: Сегодня, 18:20"
            />
          </label>

          <label className="field-block">
            <span>Этап производства</span>
            <select value={stage} onChange={(event) => setStage(event.target.value)}>
              {productionStageOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Ответственный этап</span>
            <input
              type="text"
              value={stageOwner}
              onChange={(event) => setStageOwner(event.target.value)}
              placeholder="Менеджер, технолог, цех, монтажник..."
            />
          </label>

          <label className="field-block">
            <span>Дедлайн</span>
            <input
              type="text"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              placeholder="Например: До пятницы / 14 июня"
            />
          </label>

          <label className="field-block">
            <span>Статус установки</span>
            <select
              value={installationStatus}
              onChange={(event) => setInstallationStatus(event.target.value)}
            >
              {installationStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Дата установки</span>
            <input
              type="text"
              value={installationDate}
              onChange={(event) => setInstallationDate(event.target.value)}
              placeholder="Например: 22 июня, 10:00"
            />
          </label>

          <label className="field-block">
            <span>Монтажник</span>
            <input
              type="text"
              value={installer}
              onChange={(event) => setInstaller(event.target.value)}
              placeholder="Имя ответственного монтажника"
            />
          </label>
        </div>

        <label className="field-block">
          <span>Адрес установки</span>
          <textarea
            rows={3}
            value={installationAddress}
            onChange={(event) => setInstallationAddress(event.target.value)}
            placeholder="Полный адрес объекта, подъезд, этаж, важные примечания."
          />
        </label>

        <label className="field-block">
          <span>Комментарий производства</span>
          <textarea
            rows={4}
            value={productionComment}
            onChange={(event) => setProductionComment(event.target.value)}
            placeholder="Что ждём от цеха, есть ли узкие места, что уже подтверждено."
          />
        </label>

        <label className="field-block">
          <span>Комментарий по установке</span>
          <textarea
            rows={4}
            value={installationComment}
            onChange={(event) => setInstallationComment(event.target.value)}
            placeholder="Что важно учесть монтажнику на объекте."
          />
        </label>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Сохраняем..." : "Сохранить производство и установку"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
