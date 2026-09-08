export const PROJECT_GROUPS = Object.freeze({
  development: "В разработке",
  ready: "Готовы к производству",
  production: "В производстве",
  completed: "Завершены"
});

export function getProjectGroup(lead) {
  const production = lead.order?.production || {};
  const stage = production.stage || "";
  if (stage === "Завершено" || lead.productionStatus === "Завершено") return "completed";
  if (["Не передано", "Ожидает распил", ""].includes(stage)) {
    return production.handedToProduction || lead.project?.status === "Проект утверждён"
      ? "ready" : "development";
  }
  return "production";
}

export function buildStaffProjectPatch(payload) {
  return {
    product: payload.product,
    requestType: payload.product,
    address: payload.address,
    manager: payload.manager,
    managerComment: payload.note || "",
    project: { status: "Черновик", description: payload.description, designerComment: payload.note || "" },
    measurement: { address: payload.address }
  };
}

export const MAX_PROJECT_FILE_BYTES = 20 * 1024 * 1024;
const SAFE_EXTENSIONS = new Set([
  "pdf", "jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "tif", "tiff",
  "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf", "odt", "ods",
  "dwg", "dxf", "skp", "stl", "step", "stp", "obj", "zip", "rar", "7z"
]);

export function validateProjectAttachment(file) {
  const name = String(file?.fileName || "").replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0, 180);
  const extension = name.split(".").pop().toLowerCase();
  if (!name || !SAFE_EXTENSIONS.has(extension)) throw new Error("Этот формат не поддерживается. Отправьте PDF, фото, документ, чертёж или архив.");
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_PROJECT_FILE_BYTES) {
    throw new Error("Размер файла должен быть от 1 байта до 20 МБ.");
  }
  return { ...file, fileName: name };
}

export function projectVersionConflict() {
  const error = new Error("Проект уже обновлён другим сотрудником. Откройте файлы заново и проверьте актуальную версию.");
  error.code = "PROJECT_VERSION_CONFLICT";
  return error;
}

export function nextProjectVersion(rows, input) {
  const duplicate = rows.find((row) => row.sourceRef === input.sourceRef);
  if (duplicate) return { duplicate };
  const family = rows.filter((row) => row.groupKey === input.groupKey);
  const current = family.find((row) => row.isCurrent);
  if (input.expectedCurrentId !== undefined && (current?.id || null) !== input.expectedCurrentId) {
    throw projectVersionConflict();
  }
  return { current, version: Math.max(0, ...family.map((row) => row.version)) + 1 };
}
