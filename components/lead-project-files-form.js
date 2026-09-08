"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pick } from "../lib/i18n";
import { PROJECT_FILE_SLOTS, getProjectFileSlot } from "../lib/project-file-slots";

const SLOT_TEXT = {
  render: {
    title: ["Project render", "Рендер проекта"],
    uploadLabel: ["Preview: render", "Превью: рендер"]
  },
  model: {
    title: ["3D model screenshot", "Скрин 3D-модели"],
    uploadLabel: ["Preview: 3D model", "Превью: 3D-модель"]
  },
  drawings: {
    title: ["Drawings and layout", "Чертежи и раскладка"],
    uploadLabel: ["Preview: drawings", "Превью: чертежи"]
  },
  "estimate-preview": {
    title: ["Estimate preview", "Превью сметы"],
    uploadLabel: ["Preview: estimate", "Превью: смета"]
  },
  "source-project": {
    title: ["Source project", "Исходник проекта"],
    uploadLabel: ["Source project", "Исходник проекта"]
  },
  "estimate-excel": {
    title: ["Estimate Excel", "Смета Excel"],
    uploadLabel: ["Estimate Excel", "Смета Excel"]
  },
  "drawings-pdf": {
    title: ["Drawings PDF", "PDF чертежей"],
    uploadLabel: ["Drawings PDF", "PDF чертежей"]
  }
};

function slotText(slot, lang, field) {
  const copy = SLOT_TEXT[slot?.id]?.[field];
  return copy ? pick(lang, copy[0], copy[1]) : slot?.[field] || "";
}

function createUploadRow(index = 0, overrides = {}) {
  return {
    id: `upload-row-${index + 1}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slotId: PROJECT_FILE_SLOTS[index]?.id || "source-project",
    fileName: "",
    ...overrides
  };
}

function getFileExtension(fileName) {
  const parts = String(fileName || "").toLowerCase().split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

function suggestSlotIdForFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  const extension = getFileExtension(fileName);
  const mimeType = String(file?.type || "").toLowerCase();

  if ([".xlsx", ".xls", ".csv"].includes(extension)) {
    return "estimate-excel";
  }

  if (extension === ".pdf") {
    return "drawings-pdf";
  }

  if ([".skp", ".zip", ".rar", ".7z"].includes(extension)) {
    return "source-project";
  }

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) {
    if (fileName.includes("estimate") || fileName.includes("smeta") || fileName.includes("смет")) {
      return "estimate-preview";
    }

    if (fileName.includes("draw") || fileName.includes("sheet") || fileName.includes("layout") || fileName.includes("черт") || fileName.includes("расклад")) {
      return "drawings";
    }

    if (fileName.includes("model") || fileName.includes("3d") || fileName.includes("скрин")) {
      return "model";
    }

    return "render";
  }

  return "source-project";
}

export default function LeadProjectFilesForm({
  slug,
  initialProjectAssets = {},
  initialEstimateExport = {},
  managerName = "",
  lang = "en"
}) {
  const router = useRouter();
  const [version, setVersion] = useState(initialProjectAssets.version || "");
  const [exportedAt, setExportedAt] = useState(initialProjectAssets.exportedAt || "");
  const [uploadedBy, setUploadedBy] = useState(
    initialProjectAssets.uploadedBy || managerName || ""
  );
  const [actuality, setActuality] = useState(initialProjectAssets.actuality || pick(lang, "Actual", "Актуально"));
  const [sourceProgram, setSourceProgram] = useState(
    initialProjectAssets.sourceProgram || pick(lang, "External design software", "Внешняя проектная программа")
  );
  const [sheets, setSheets] = useState(
    Array.isArray(initialEstimateExport.sheets) ? initialEstimateExport.sheets.join(", ") : ""
  );
  const [uploadRows, setUploadRows] = useState([createUploadRow(0), createUploadRow(1)]);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dragActiveRowId, setDragActiveRowId] = useState("");
  const [dropAssignments, setDropAssignments] = useState([]);
  const fileInputRefs = useRef({});

  useEffect(() => {
    if (!dropAssignments.length) {
      return;
    }

    for (const assignment of dropAssignments) {
      const input = fileInputRefs.current[assignment.rowId];

      if (!input || !assignment.file) {
        continue;
      }

      const transfer = new DataTransfer();
      transfer.items.add(assignment.file);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setDropAssignments([]);
  }, [dropAssignments]);

  function updateRow(rowId, updates) {
    setUploadRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...updates } : row))
    );
  }

  function addRow() {
    setUploadRows((current) => [...current, createUploadRow(current.length)]);
  }

  function removeRow(rowId) {
    delete fileInputRefs.current[rowId];
    setUploadRows((current) => {
      const next = current.filter((row) => row.id !== rowId);
      return next.length ? next : [createUploadRow(0)];
    });
  }

  function assignFilesToRows(files) {
    if (!files.length) {
      return;
    }

    const nextRows = [...uploadRows];
    const assignments = [];

    files.forEach((file, index) => {
      if (!nextRows[index]) {
        nextRows.push(createUploadRow(nextRows.length));
      }

      const targetRow = nextRows[index];
      const suggestedSlotId = suggestSlotIdForFile(file);

      nextRows[index] = {
        ...targetRow,
        slotId: suggestedSlotId,
        fileName: file.name
      };
      assignments.push({
        rowId: targetRow.id,
        file
      });
    });

    setUploadRows(nextRows);
    setDropAssignments(assignments);
  }

  function handleGlobalDrop(event) {
    event.preventDefault();
    setDragActiveRowId("");
    const files = Array.from(event.dataTransfer?.files || []);
    assignFilesToRows(files);
    setFeedback(
      files.length
        ? pick(
            lang,
            `Files assigned to rows: ${files.length}. Check the slots and upload.`,
            `Файлы распределены по строкам: ${files.length}. Проверь слоты и загружай.`
          )
        : ""
    );
  }

  function handleRowDrop(event, rowId) {
    event.preventDefault();
    setDragActiveRowId("");
    const files = Array.from(event.dataTransfer?.files || []);

    if (!files.length) {
      return;
    }

    const file = files[0];
    updateRow(rowId, {
      slotId: suggestSlotIdForFile(file),
      fileName: file.name
    });
    setDropAssignments([{ rowId, file }]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");

    const sourceForm = event.currentTarget;

    try {
      const sourceData = new FormData(sourceForm);
      const queue = uploadRows
        .map((row) => ({
          row,
          slot: getProjectFileSlot(row.slotId),
          file: sourceData.get(`file-${row.id}`)
        }))
        .filter(
          ({ file }) => file && typeof file.arrayBuffer === "function" && String(file.name || "").trim()
        );

      if (!queue.length) {
        setFeedback(pick(lang, "Select at least one file", "Выбери хотя бы один файл для загрузки"));
        return;
      }

      const success = [];
      const failed = [];

      for (const item of queue) {
        const uploadData = new FormData();
        uploadData.append("action", "project-file-upload");
        uploadData.append("slot", item.row.slotId);
        uploadData.append("expectedCurrentId", initialProjectAssets.versions?.find((file) => file.groupKey === item.row.slotId && file.isCurrent)?.id || "");
        uploadData.append("sourceRef", `web:${item.row.id}:${item.file.name}:${item.file.size}:${item.file.lastModified}`);
        uploadData.append("file", item.file);
        uploadData.append("version", version);
        uploadData.append("exportedAt", exportedAt);
        uploadData.append("uploadedBy", uploadedBy);
        uploadData.append("actuality", actuality);
        uploadData.append("sourceProgram", sourceProgram);

        if (item.row.slotId === "estimate-excel") {
          uploadData.append("sheets", sheets);
        }

        const response = await fetch(`/api/leads/${slug}`, {
          method: "PATCH",
          body: uploadData
        });
        const result = await response.json().catch(() => null);

        if (response.ok) {
          success.push(slotText(item.slot, lang, "title") || item.row.slotId);
        } else {
          failed.push(result?.message || slotText(item.slot, lang, "title") || item.row.slotId);
        }
      }

      if (success.length) {
        sourceForm.reset();
        setUploadRows([createUploadRow(0), createUploadRow(1)]);
        router.refresh();
      }

      if (success.length && !failed.length) {
        setFeedback(
          pick(lang, `Uploaded files: ${success.length}`, `Загружено файлов: ${success.length}`)
        );
        return;
      }

      if (success.length && failed.length) {
        setFeedback(
          pick(
            lang,
            `Partially complete: ${success.length} uploaded, ${failed.length} failed`,
            `Частично готово: загружено ${success.length}, с ошибкой ${failed.length}`
          )
        );
        return;
      }

      setFeedback(failed[0] || pick(lang, "Upload failed", "Загрузка не выполнена"));
    } catch (error) {
      setFeedback(`${pick(lang, "Upload error", "Ошибка загрузки")}: ${error.message}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="summary-card project-file-upload-panel">
      <div className="mini-item-head">
        <strong>{pick(lang, "Attach project files", "Прикрепить файлы проекта")}</strong>
        <span className="status-chip">{pick(lang, "Batch upload", "Пакетная загрузка")}</span>
      </div>
      <p>
        {pick(
          lang,
          "Upload previews, Excel, PDF and the source file in one pass without reopening the deal card again and again.",
          "Загрузи превью, Excel, PDF и исходник за один проход, без повторного открытия карточки сделки."
        )}
      </p>

      <form
        className="workflow-form"
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleGlobalDrop}
        onSubmit={handleSubmit}
      >
        <div className="project-upload-drop-hint">
          <strong>{pick(lang, "Drop several files here", "Перетащи сюда сразу несколько файлов")}</strong>
          <span>{pick(lang, "The form will pre-fill the rows, then you only need to check and upload.", "Форма сама разложит их по строкам, потом останется проверить и загрузить.")}</span>
        </div>

        <div className="lead-detail-grid" style={{ marginTop: 0 }}>
          <label className="field-block">
            <span>{pick(lang, "Version", "Версия")}</span>
            <input
              name="version"
              onChange={(event) => setVersion(event.target.value)}
              placeholder={pick(lang, "For example: Export v2", "Например: Экспорт v2")}
              type="text"
              value={version}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Exported at", "Дата экспорта")}</span>
            <input
              name="exportedAt"
              onChange={(event) => setExportedAt(event.target.value)}
              placeholder={pick(lang, "For example: Today, 16:40", "Например: Сегодня, 16:40")}
              type="text"
              value={exportedAt}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Uploaded by", "Кто загрузил")}</span>
            <input
              name="uploadedBy"
              onChange={(event) => setUploadedBy(event.target.value)}
              placeholder={pick(lang, "For example: Designer", "Например: Проектировщик")}
              type="text"
              value={uploadedBy}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Actuality", "Актуальность")}</span>
            <input
              name="actuality"
              onChange={(event) => setActuality(event.target.value)}
              placeholder={pick(lang, "Actual / Draft / Pending approval", "Актуально / Черновик / На согласовании")}
              type="text"
              value={actuality}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "External software", "Внешняя программа")}</span>
            <input
              name="sourceProgram"
              onChange={(event) => setSourceProgram(event.target.value)}
              placeholder="SketchUp + Excel"
              type="text"
              value={sourceProgram}
            />
          </label>

          <label className="field-block">
            <span>{pick(lang, "Excel sheets", "Листы Excel")}</span>
            <input
              name="sheets"
              onChange={(event) => setSheets(event.target.value)}
              placeholder="Data, Sum"
              type="text"
              value={sheets}
            />
          </label>
        </div>

        <div className="compact-list">
          {uploadRows.map((row, index) => {
            const slot = getProjectFileSlot(row.slotId);

            return (
              <article
                className={`summary-card project-upload-row${
                  dragActiveRowId === row.id ? " project-upload-row-active" : ""
                }`}
                key={row.id}
                onDragEnter={() => setDragActiveRowId(row.id)}
                onDragLeave={() => setDragActiveRowId((current) => (current === row.id ? "" : current))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleRowDrop(event, row.id)}
              >
                <div className="mini-item-head">
                  <strong>{pick(lang, `File ${index + 1}`, `Файл ${index + 1}`)}</strong>
                  <button className="ghost-button" onClick={() => removeRow(row.id)} type="button">
                    {pick(lang, "Remove row", "Удалить строку")}
                  </button>
                </div>

                <div className="lead-detail-grid" style={{ marginTop: 16 }}>
                  <label className="field-block">
                    <span>{pick(lang, "Slot", "Что прикрепляем")}</span>
                    <select
                      onChange={(event) =>
                        updateRow(row.id, { slotId: event.target.value, fileName: "" })
                      }
                      value={row.slotId}
                    >
                      {PROJECT_FILE_SLOTS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {slotText(item, lang, "uploadLabel")}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field-block">
                    <span>{pick(lang, "File", "Файл")}</span>
                    <input
                      accept={slot?.accept || "*"}
                      name={`file-${row.id}`}
                      onChange={(event) =>
                        updateRow(row.id, {
                          fileName: event.target.files?.[0]?.name || ""
                        })
                      }
                      ref={(node) => {
                        fileInputRefs.current[row.id] = node;
                      }}
                      type="file"
                    />
                  </label>
                </div>

                <div className="project-upload-dropzone">
                  <strong>{pick(lang, "You can also drop the file here", "Можно перетащить файл прямо сюда")}</strong>
                  <span>{slot?.accept || pick(lang, "Any format", "Любой формат")}</span>
                </div>

                <p className="compact-note">
                  {row.fileName || slotText(slot, lang, "title") || pick(lang, "No file selected yet", "Файл пока не выбран")}
                </p>
              </article>
            );
          })}
        </div>

        <div className="workflow-actions">
          <button className="ghost-button" onClick={addRow} type="button">
            {pick(lang, "Add one more file", "Добавить ещё файл")}
          </button>
          <button className="primary-button" disabled={pending} type="submit">
            {pending ? pick(lang, "Uploading...", "Загружаем...") : pick(lang, "Upload selected files", "Загрузить выбранные файлы")}
          </button>
        </div>
        {feedback ? <p className="form-feedback">{feedback}</p> : null}
      </form>
    </article>
  );
}
