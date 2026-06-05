export const PROJECT_FILE_SLOTS = [
  {
    id: "render",
    title: "Рендер проекта",
    type: "image",
    note: "Главное превью для менеджера и клиента.",
    preview: true,
    required: false,
    baseName: "render-preview",
    fallbackFileNames: ["render-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Превью: рендер"
  },
  {
    id: "model",
    title: "Скрин 3D-модели",
    type: "image",
    note: "Рабочий вид проекта из внешней программы.",
    preview: true,
    required: false,
    baseName: "model-preview",
    fallbackFileNames: ["model-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Превью: 3D-модель"
  },
  {
    id: "drawings",
    title: "Чертежи и раскладка",
    type: "image",
    note: "Сводный лист по фасадам, секциям и схемам.",
    preview: true,
    required: false,
    baseName: "drawings-overview",
    fallbackFileNames: ["drawings-overview.jpeg"],
    accept: "image/*",
    uploadLabel: "Превью: чертежи"
  },
  {
    id: "estimate-preview",
    title: "Превью сметы",
    type: "image",
    note: "Быстрый просмотр итоговой таблицы без открытия Excel.",
    preview: true,
    required: false,
    baseName: "estimate-preview",
    fallbackFileNames: ["estimate-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Превью: смета"
  },
  {
    id: "source-project",
    title: "Исходник проекта (.skp)",
    type: "source",
    note: "Оригинальный файл из проектной программы.",
    preview: false,
    required: true,
    baseName: "project-source",
    fallbackFileNames: ["project-source.skp"],
    accept: ".skp,.zip,.rar,.7z",
    uploadLabel: "Исходник проекта"
  },
  {
    id: "estimate-excel",
    title: "Смета Excel (.xlsx)",
    type: "estimate",
    note: "Рабочая таблица со слоями Data и Sum.",
    preview: false,
    required: true,
    baseName: "estimate-source",
    fallbackFileNames: ["estimate-source.xlsx"],
    accept: ".xlsx,.xls,.csv",
    uploadLabel: "Смета Excel"
  },
  {
    id: "drawings-pdf",
    title: "PDF чертежей",
    type: "pdf",
    note: "Слот под экспорт чертежей для клиента и производства.",
    preview: false,
    required: true,
    baseName: "drawings",
    fallbackFileNames: ["drawings.pdf"],
    accept: ".pdf",
    uploadLabel: "PDF чертежей"
  }
];

export function getProjectFileSlot(slotId) {
  return PROJECT_FILE_SLOTS.find((slot) => slot.id === slotId) || null;
}

export function getProjectPreviewSlots() {
  return PROJECT_FILE_SLOTS.filter((slot) => slot.preview);
}

export function getProjectDocumentSlots() {
  return PROJECT_FILE_SLOTS.filter((slot) => !slot.preview);
}
