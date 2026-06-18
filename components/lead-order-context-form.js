"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";
import {
  FINAL_PAYMENT_STATUS_OPTIONS,
  PREPAYMENT_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  normalizeStatusValue
} from "../lib/order-statuses";

function createEmptyOrderItem(index = 0) {
  return {
    id: `custom-item-${index + 1}`,
    title: "",
    zone: "",
    quantity: "1",
    dimensions: "",
    material: "",
    facade: "",
    hardware: "",
    amount: "",
    status: "Draft"
  };
}

function normalizeInitialItems(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return [createEmptyOrderItem(0)];
  }

  return items.map((item, index) => ({
    id: item.id || `custom-item-${index + 1}`,
    title: item.title || "",
    zone: item.zone || "",
    quantity: String(item.quantity || 1),
    dimensions: item.dimensions || "",
    material: item.material || "",
    facade: item.facade || "",
    hardware: item.hardware || "",
    amount: item.amount || "",
    status: item.status || "Draft"
  }));
}

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

export default function LeadOrderContextForm({
  slug,
  initialProject = {},
  initialCalculation = {},
  initialItems = [],
  lang = "en"
}) {
  const router = useRouter();
  const [projectStatus, setProjectStatus] = useState(
    normalizeStatusValue(PROJECT_STATUS_OPTIONS, initialProject.status, "draft")
  );
  const [description, setDescription] = useState(initialProject.description || "");
  const [materials, setMaterials] = useState(initialProject.materials || "");
  const [hardware, setHardware] = useState(initialProject.hardware || "");
  const [color, setColor] = useState(initialProject.color || "");
  const [designerComment, setDesignerComment] = useState(initialProject.designerComment || "");
  const [preparedAt, setPreparedAt] = useState(initialProject.preparedAt || "");
  const [preliminaryAmount, setPreliminaryAmount] = useState(initialCalculation.preliminaryAmount || "");
  const [finalAmount, setFinalAmount] = useState(initialCalculation.finalAmount || "");
  const [prepaymentAmount, setPrepaymentAmount] = useState(initialCalculation.prepaymentAmount || "");
  const [balanceDue, setBalanceDue] = useState(initialCalculation.balanceDue || "");
  const [prepaymentStatus, setPrepaymentStatus] = useState(
    normalizeStatusValue(PREPAYMENT_STATUS_OPTIONS, initialCalculation.prepaymentStatus, "not-requested")
  );
  const [finalPaymentStatus, setFinalPaymentStatus] = useState(
    normalizeStatusValue(FINAL_PAYMENT_STATUS_OPTIONS, initialCalculation.finalPaymentStatus, "not-requested")
  );
  const [orderItems, setOrderItems] = useState(normalizeInitialItems(initialItems));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  function updateOrderItem(index, field, value) {
    setOrderItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
  }

  function addOrderItem() {
    setOrderItems((current) => [...current, createEmptyOrderItem(current.length)]);
  }

  function removeOrderItem(index) {
    setOrderItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length ? next : [createEmptyOrderItem(0)];
    });
  }

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
          project: {
            status: projectStatus,
            description,
            materials,
            hardware,
            color,
            designerComment,
            preparedAt
          },
          calculation: {
            preliminaryAmount,
            finalAmount,
            prepaymentAmount,
            balanceDue,
            prepaymentStatus,
            finalPaymentStatus
          },
          orderItems
        })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || pick(lang, "Failed to save project context", "Не удалось сохранить проектный блок"));
      }

      setFeedback(pick(lang, "Project, estimate and order items saved", "Проект, смета и состав заказа сохранены"));
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
        <p className="eyebrow">{pick(lang, "Project and estimate", "Проект и смета")}</p>
        <h2>{pick(lang, "Update project context", "Обновить проектный блок")}</h2>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="lead-detail-grid" style={{ marginTop: 0 }}>
          <OptionSelect
            label={pick(lang, "Project status", "Статус проекта")}
            options={PROJECT_STATUS_OPTIONS}
            value={projectStatus}
            onChange={setProjectStatus}
            lang={lang}
          />

          <label className="field-block">
            <span>{pick(lang, "Project prepared at", "Дата подготовки проекта")}</span>
            <input
              type="text"
              value={preparedAt}
              onChange={(event) => setPreparedAt(event.target.value)}
              placeholder={pick(lang, "For example: Today, 16:40", "Например: Сегодня, 16:40")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Materials", "Материалы")}</span>
            <input
              type="text"
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
              placeholder={pick(lang, "Egger chipboard, MDF, veneer...", "ЛДСП Egger, МДФ, шпон...")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Hardware", "Фурнитура")}</span>
            <input
              type="text"
              value={hardware}
              onChange={(event) => setHardware(event.target.value)}
              placeholder="Blum, Hettich, Boyard..."
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Color", "Цвет")}</span>
            <input
              type="text"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder={pick(lang, "White matte, oak, graphite...", "Белый мат, дуб, графит...")}
            />
          </label>

          <OptionSelect
            label={pick(lang, "Deposit status", "Статус предоплаты")}
            options={PREPAYMENT_STATUS_OPTIONS}
            value={prepaymentStatus}
            onChange={setPrepaymentStatus}
            lang={lang}
          />

          <label className="field-block">
            <span>{pick(lang, "Preliminary amount", "Предварительная сумма")}</span>
            <input
              type="text"
              value={preliminaryAmount}
              onChange={(event) => setPreliminaryAmount(event.target.value)}
              placeholder={pick(lang, "For example: 1 800 000 KZT", "Например: 1 800 000 ₸")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Final amount", "Итоговая сумма")}</span>
            <input
              type="text"
              value={finalAmount}
              onChange={(event) => setFinalAmount(event.target.value)}
              placeholder={pick(lang, "For example: 1 950 000 KZT", "Например: 1 950 000 ₸")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Deposit amount", "Сумма предоплаты")}</span>
            <input
              type="text"
              value={prepaymentAmount}
              onChange={(event) => setPrepaymentAmount(event.target.value)}
              placeholder={pick(lang, "For example: 585 000 KZT", "Например: 585 000 ₸")}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Balance due", "Остаток к оплате")}</span>
            <input
              type="text"
              value={balanceDue}
              onChange={(event) => setBalanceDue(event.target.value)}
              placeholder={pick(lang, "For example: 1 365 000 KZT", "Например: 1 365 000 ₸")}
            />
          </label>

          <OptionSelect
            label={pick(lang, "Final payment status", "Статус финальной оплаты")}
            options={FINAL_PAYMENT_STATUS_OPTIONS}
            value={finalPaymentStatus}
            onChange={setFinalPaymentStatus}
            lang={lang}
          />
        </div>

        <label className="field-block">
          <span>{pick(lang, "Project description", "Описание проекта")}</span>
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={pick(
              lang,
              "What is included in the order, which zones are confirmed, and what should go into the estimate.",
              "Что входит в заказ, какие зоны подтверждены и что нужно включить в смету."
            )}
          />
        </label>

        <label className="field-block">
          <span>{pick(lang, "Designer note", "Комментарий проектировщика")}</span>
          <textarea
            rows={4}
            value={designerComment}
            onChange={(event) => setDesignerComment(event.target.value)}
            placeholder={pick(
              lang,
              "Constraints, pending decisions, materials to confirm, or anything the team should know.",
              "Ограничения, незакрытые решения, материалы на подтверждении и важные замечания для команды."
            )}
          />
        </label>

        <div className="section-title" style={{ marginTop: 8 }}>
          <p className="eyebrow">{pick(lang, "Order items", "Состав заказа")}</p>
          <h2>{pick(lang, "Estimate positions", "Позиции сметы")}</h2>
        </div>

        <div className="compact-list">
          {orderItems.map((item, index) => (
            <article className="summary-card" key={item.id || `item-${index}`}>
              <div className="mini-item-head">
                <strong>{item.title || pick(lang, `Item ${index + 1}`, `Позиция ${index + 1}`)}</strong>
                <button className="ghost-button" onClick={() => removeOrderItem(index)} type="button">
                  {pick(lang, "Remove", "Удалить")}
                </button>
              </div>

              <div className="lead-detail-grid" style={{ marginTop: 16 }}>
                <label className="field-block">
                  <span>{pick(lang, "Title", "Название")}</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) => updateOrderItem(index, "title", event.target.value)}
                    placeholder={pick(lang, "Built-in wardrobe", "Встроенный шкаф")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Zone", "Зона")}</span>
                  <input
                    type="text"
                    value={item.zone}
                    onChange={(event) => updateOrderItem(index, "zone", event.target.value)}
                    placeholder={pick(lang, "Bedroom, kitchen, hall...", "Спальня, кухня, прихожая...")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Quantity", "Количество")}</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateOrderItem(index, "quantity", event.target.value)}
                    placeholder="1"
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Amount", "Сумма")}</span>
                  <input
                    type="text"
                    value={item.amount}
                    onChange={(event) => updateOrderItem(index, "amount", event.target.value)}
                    placeholder={pick(lang, "For example: 650 000 KZT", "Например: 650 000 ₸")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Status", "Статус")}</span>
                  <input
                    type="text"
                    value={item.status}
                    onChange={(event) => updateOrderItem(index, "status", event.target.value)}
                    placeholder={pick(lang, "Draft / Approved / In production", "Черновик / Согласовано / В производстве")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Dimensions", "Размеры")}</span>
                  <input
                    type="text"
                    value={item.dimensions}
                    onChange={(event) => updateOrderItem(index, "dimensions", event.target.value)}
                    placeholder="3200 x 2600 x 600"
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Material", "Материал")}</span>
                  <input
                    type="text"
                    value={item.material}
                    onChange={(event) => updateOrderItem(index, "material", event.target.value)}
                    placeholder={pick(lang, "Egger chipboard, MDF...", "ЛДСП Egger, МДФ...")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Facades", "Фасады")}</span>
                  <input
                    type="text"
                    value={item.facade}
                    onChange={(event) => updateOrderItem(index, "facade", event.target.value)}
                    placeholder={pick(lang, "Painted MDF, veneer...", "Крашеный МДФ, шпон...")}
                  />
                </label>

                <label className="field-block">
                  <span>{pick(lang, "Hardware", "Фурнитура")}</span>
                  <input
                    type="text"
                    value={item.hardware}
                    onChange={(event) => updateOrderItem(index, "hardware", event.target.value)}
                    placeholder="Blum, Hettich, Boyard..."
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <div className="workflow-actions">
          <button className="ghost-button" onClick={addOrderItem} type="button">
            {pick(lang, "Add item", "Добавить позицию")}
          </button>
        </div>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Saving...", "Сохраняем...") : pick(lang, "Save project context", "Сохранить проектный блок")}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
