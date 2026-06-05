"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PROJECT_STATUS_OPTIONS = [
  "Черновик",
  "После замера собираем проект",
  "Эскиз и смета в работе",
  "Проект отправлен клиенту",
  "Проект согласован",
  "Проект утверждён"
];

const PREPAYMENT_STATUS_OPTIONS = [
  "Не запрошена",
  "Запрошена",
  "Ожидаем предоплату",
  "Предоплата получена"
];

const FINAL_PAYMENT_STATUS_OPTIONS = [
  "Финальная оплата не запрошена",
  "Ждём окончательную оплату",
  "Оплачено полностью"
];

function withCurrentValue(options, value) {
  return value && !options.includes(value) ? [value, ...options] : options;
}

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
    status: "Черновик"
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
    status: item.status || "Черновик"
  }));
}

export default function LeadOrderContextForm({
  slug,
  initialProject = {},
  initialCalculation = {},
  initialItems = []
}) {
  const router = useRouter();
  const [projectStatus, setProjectStatus] = useState(initialProject.status || "Черновик");
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
    initialCalculation.prepaymentStatus || "Не запрошена"
  );
  const [finalPaymentStatus, setFinalPaymentStatus] = useState(
    initialCalculation.finalPaymentStatus || "Финальная оплата не запрошена"
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

      const result = await response.json();
      setFeedback(result.message || "Проект, расчёт и состав заказа сохранены");

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      setFeedback(`Ошибка формы: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  const projectStatusOptions = withCurrentValue(PROJECT_STATUS_OPTIONS, projectStatus);
  const prepaymentStatusOptions = withCurrentValue(PREPAYMENT_STATUS_OPTIONS, prepaymentStatus);
  const finalPaymentStatusOptions = withCurrentValue(
    FINAL_PAYMENT_STATUS_OPTIONS,
    finalPaymentStatus
  );

  return (
    <section className="panel workflow-form-panel">
      <div className="section-title">
        <p className="eyebrow">Проект и расчёт</p>
        <h2>Обновить проектную часть заказа</h2>
        <p>
          Здесь менеджер или проектировщик фиксирует рабочее описание проекта, материалы,
          суммы и сам состав заказа, чтобы карточка жила вместе с реальной сметой.
        </p>
      </div>

      <form className="workflow-form" onSubmit={handleSubmit}>
        <div className="lead-detail-grid" style={{ marginTop: 0 }}>
          <label className="field-block">
            <span>Статус проекта</span>
            <select value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)}>
              {projectStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Дата подготовки проекта</span>
            <input
              type="text"
              value={preparedAt}
              onChange={(event) => setPreparedAt(event.target.value)}
              placeholder="Например: Сегодня, 16:40"
            />
          </label>

          <label className="field-block">
            <span>Материалы</span>
            <input
              type="text"
              value={materials}
              onChange={(event) => setMaterials(event.target.value)}
              placeholder="ЛДСП Egger, МДФ и т.д."
            />
          </label>

          <label className="field-block">
            <span>Фурнитура</span>
            <input
              type="text"
              value={hardware}
              onChange={(event) => setHardware(event.target.value)}
              placeholder="Blum, Hettich, Boyard..."
            />
          </label>

          <label className="field-block">
            <span>Цвет</span>
            <input
              type="text"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              placeholder="Белый мат, дуб, графит..."
            />
          </label>

          <label className="field-block">
            <span>Статус предоплаты</span>
            <select
              value={prepaymentStatus}
              onChange={(event) => setPrepaymentStatus(event.target.value)}
            >
              {prepaymentStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Предварительная сумма</span>
            <input
              type="text"
              value={preliminaryAmount}
              onChange={(event) => setPreliminaryAmount(event.target.value)}
              placeholder="Например: 1 800 000 ₸"
            />
          </label>

          <label className="field-block">
            <span>Итоговая сумма</span>
            <input
              type="text"
              value={finalAmount}
              onChange={(event) => setFinalAmount(event.target.value)}
              placeholder="Например: 1 950 000 ₸"
            />
          </label>

          <label className="field-block">
            <span>Сумма предоплаты</span>
            <input
              type="text"
              value={prepaymentAmount}
              onChange={(event) => setPrepaymentAmount(event.target.value)}
              placeholder="Например: 585 000 ₸"
            />
          </label>

          <label className="field-block">
            <span>Остаток к оплате</span>
            <input
              type="text"
              value={balanceDue}
              onChange={(event) => setBalanceDue(event.target.value)}
              placeholder="Например: 1 365 000 ₸"
            />
          </label>

          <label className="field-block">
            <span>Статус окончательной оплаты</span>
            <select
              value={finalPaymentStatus}
              onChange={(event) => setFinalPaymentStatus(event.target.value)}
            >
              {finalPaymentStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-block">
          <span>Описание проекта</span>
          <textarea
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Что делаем по заказу, какие зоны и какой состав мебели уже подтверждён."
          />
        </label>

        <label className="field-block">
          <span>Комментарий проектировщика</span>
          <textarea
            rows={4}
            value={designerComment}
            onChange={(event) => setDesignerComment(event.target.value)}
            placeholder="Что важно учесть в проекте, где есть ограничения и что ещё ждём от клиента."
          />
        </label>

        <div className="section-title" style={{ marginTop: 8 }}>
          <p className="eyebrow">Состав заказа</p>
          <h2>Позиции сметы и заказа</h2>
          <p>
            Каждая позиция из этого списка сразу попадает в смету и помогает держать под
            контролем не только сумму, но и сам состав мебели по зонам.
          </p>
        </div>

        <div className="compact-list">
          {orderItems.map((item, index) => (
            <article className="summary-card" key={item.id || `item-${index}`}>
              <div className="mini-item-head">
                <strong>{item.title || `Позиция ${index + 1}`}</strong>
                <button
                  className="ghost-button"
                  onClick={() => removeOrderItem(index)}
                  type="button"
                >
                  Удалить
                </button>
              </div>

              <div className="lead-detail-grid" style={{ marginTop: 16 }}>
                <label className="field-block">
                  <span>Название</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(event) => updateOrderItem(index, "title", event.target.value)}
                    placeholder="Например: Встроенный шкаф"
                  />
                </label>

                <label className="field-block">
                  <span>Зона</span>
                  <input
                    type="text"
                    value={item.zone}
                    onChange={(event) => updateOrderItem(index, "zone", event.target.value)}
                    placeholder="Спальня, кухня, прихожая..."
                  />
                </label>

                <label className="field-block">
                  <span>Количество</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => updateOrderItem(index, "quantity", event.target.value)}
                    placeholder="1"
                  />
                </label>

                <label className="field-block">
                  <span>Сумма</span>
                  <input
                    type="text"
                    value={item.amount}
                    onChange={(event) => updateOrderItem(index, "amount", event.target.value)}
                    placeholder="Например: 650 000 ₸"
                  />
                </label>

                <label className="field-block">
                  <span>Статус</span>
                  <input
                    type="text"
                    value={item.status}
                    onChange={(event) => updateOrderItem(index, "status", event.target.value)}
                    placeholder="Черновик / Согласовано / В производстве"
                  />
                </label>

                <label className="field-block">
                  <span>Размеры</span>
                  <input
                    type="text"
                    value={item.dimensions}
                    onChange={(event) => updateOrderItem(index, "dimensions", event.target.value)}
                    placeholder="Например: 3200 x 2600 x 600"
                  />
                </label>

                <label className="field-block">
                  <span>Материал</span>
                  <input
                    type="text"
                    value={item.material}
                    onChange={(event) => updateOrderItem(index, "material", event.target.value)}
                    placeholder="ЛДСП Egger, МДФ..."
                  />
                </label>

                <label className="field-block">
                  <span>Фасады</span>
                  <input
                    type="text"
                    value={item.facade}
                    onChange={(event) => updateOrderItem(index, "facade", event.target.value)}
                    placeholder="Крашеный МДФ, шпон..."
                  />
                </label>

                <label className="field-block">
                  <span>Фурнитура</span>
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
            Добавить позицию
          </button>
        </div>

        <div className="workflow-actions">
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? "Сохраняем..." : "Сохранить проект, смету и состав"}
          </button>
          {feedback ? <p className="form-feedback">{feedback}</p> : null}
        </div>
      </form>
    </section>
  );
}
