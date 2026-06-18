export const PROJECT_FILE_SLOTS = [
  {
    id: "render",
    title: "Project render",
    type: "image",
    note: "Main preview for the manager and client.",
    preview: true,
    required: false,
    baseName: "render-preview",
    fallbackFileNames: ["render-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Preview: render"
  },
  {
    id: "model",
    title: "3D model screenshot",
    type: "image",
    note: "Working view from the external design tool.",
    preview: true,
    required: false,
    baseName: "model-preview",
    fallbackFileNames: ["model-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Preview: 3D model"
  },
  {
    id: "drawings",
    title: "Drawings and layout",
    type: "image",
    note: "Overview sheet for sections, fronts and layout.",
    preview: true,
    required: false,
    baseName: "drawings-overview",
    fallbackFileNames: ["drawings-overview.jpeg"],
    accept: "image/*",
    uploadLabel: "Preview: drawings"
  },
  {
    id: "estimate-preview",
    title: "Estimate preview",
    type: "image",
    note: "Quick view of the final estimate without opening Excel.",
    preview: true,
    required: false,
    baseName: "estimate-preview",
    fallbackFileNames: ["estimate-preview.jpeg"],
    accept: "image/*",
    uploadLabel: "Preview: estimate"
  },
  {
    id: "source-project",
    title: "Source project (.skp)",
    type: "source",
    note: "Original file from the design software.",
    preview: false,
    required: true,
    baseName: "project-source",
    fallbackFileNames: ["project-source.skp"],
    accept: ".skp,.zip,.rar,.7z",
    uploadLabel: "Source project"
  },
  {
    id: "estimate-excel",
    title: "Estimate Excel (.xlsx)",
    type: "estimate",
    note: "Working spreadsheet with sheets such as Data and Sum.",
    preview: false,
    required: true,
    baseName: "estimate-source",
    fallbackFileNames: ["estimate-source.xlsx"],
    accept: ".xlsx,.xls,.csv",
    uploadLabel: "Estimate Excel"
  },
  {
    id: "drawings-pdf",
    title: "Drawings PDF",
    type: "pdf",
    note: "Export for the client and production team.",
    preview: false,
    required: true,
    baseName: "drawings",
    fallbackFileNames: ["drawings.pdf"],
    accept: ".pdf",
    uploadLabel: "Drawings PDF"
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
