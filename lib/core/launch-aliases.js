const DEMO_CLIENT_ALIASES = new Map([
  ["31fd3831-f95c-4466-b40b-055eb5c723f8", "Client Demo"],
  ["33333333-3333-3333-3333-333333333331", "Client One"],
  ["33333333-3333-3333-3333-333333333332", "Client Two"],
  ["33333333-3333-3333-3333-333333333333", "Client Three"],
  ["33333333-3333-3333-3333-333333333334", "Client Four"],
  ["33333333-3333-3333-3333-333333333335", "Client Five"]
]);

const DEMO_STAFF_ALIASES_BY_ID = new Map([
  ["22222222-2222-2222-2222-222222222222", "Sales Lead"],
  ["22222222-2222-2222-2222-222222222223", "Account Manager"],
  ["22222222-2222-2222-2222-222222222224", "Field Specialist"]
]);

const DEMO_STAFF_ALIASES_BY_NAME = new Map([
  ["Айдана", "Sales Lead"],
  ["Тимур", "Account Manager"],
  ["Ерлан", "Field Specialist"],
  ["Test", "Workspace Owner"],
  ["Не назначен", "Unassigned"]
]);

const DEMO_TASK_TITLES = new Map([
  ["44444444-4444-4444-4444-444444444441", "First outreach"],
  ["44444444-4444-4444-4444-444444444442", "Evening follow-up"],
  ["44444444-4444-4444-4444-444444444443", "Confirm scheduled visit"],
  ["44444444-4444-4444-4444-444444444444", "Proposal follow-up"],
  ["44444444-4444-4444-4444-444444444445", "Installation check"]
]);

export function hasCyrillic(value) {
  return /[А-Яа-яЁё]/.test(String(value || ""));
}

export function sanitizeLaunchText(value, fallback = "") {
  const text = String(value || fallback || "").replace(/Â·/g, "·").replace(/\s+/g, " ").trim();
  return text || fallback || "";
}

export function getDemoStaffAlias({ userId, name, fallback = "Unassigned" } = {}) {
  const aliasById = DEMO_STAFF_ALIASES_BY_ID.get(String(userId || ""));
  if (aliasById) {
    return aliasById;
  }

  const aliasByName = DEMO_STAFF_ALIASES_BY_NAME.get(sanitizeLaunchText(name));
  if (aliasByName) {
    return aliasByName;
  }

  return sanitizeLaunchText(name, fallback);
}

export function getLaunchClientDisplayName({ sourceLeadId, displayName }) {
  const alias = DEMO_CLIENT_ALIASES.get(String(sourceLeadId || ""));
  return alias || sanitizeLaunchText(displayName, "Client");
}

export function getLaunchDealTitle({ leadId, title, clientName }) {
  const rawTitle = sanitizeLaunchText(title, "Deal");
  const alias = DEMO_CLIENT_ALIASES.get(String(leadId || ""));
  if (!alias) {
    return rawTitle;
  }

  const cleanClientName = sanitizeLaunchText(clientName);
  if (cleanClientName && rawTitle.includes(cleanClientName)) {
    return rawTitle.replace(cleanClientName, alias);
  }

  const parts = rawTitle.split("·").map((item) => item.trim()).filter(Boolean);
  if (parts.length > 1) {
    return `${alias} · ${parts.slice(1).join(" · ")}`;
  }

  if (hasCyrillic(rawTitle)) {
    return `${alias} · Active Deal`;
  }

  return rawTitle;
}

export function getLaunchLeadName({ leadId, leadName }) {
  const alias = DEMO_CLIENT_ALIASES.get(String(leadId || ""));
  return alias || sanitizeLaunchText(leadName, "Client");
}

export function getLaunchTaskTitle({ taskId, title, leadId }) {
  const explicit = DEMO_TASK_TITLES.get(String(taskId || ""));
  if (explicit) {
    return explicit;
  }

  if (DEMO_CLIENT_ALIASES.has(String(leadId || "")) && hasCyrillic(title)) {
    return "Client task";
  }

  return sanitizeLaunchText(title, "Task");
}
