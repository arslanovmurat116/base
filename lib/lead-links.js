export const LEAD_SECTION_HASHES = {
  summary: "deal-summary",
  workflow: "deal-workflow",
  project: "deal-project",
  projectEditor: "deal-project-editor",
  estimate: "deal-estimate",
  drawings: "deal-drawings",
  orderItems: "deal-order-items",
  production: "deal-production",
  productionEditor: "deal-production-editor",
  measurements: "deal-measurements",
  followups: "deal-followups",
  history: "deal-history",
  nextSteps: "deal-next-steps"
};

function normalizeText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
}

export function buildLeadHref(slug, section = "summary") {
  if (!slug) {
    return null;
  }

  const hash = LEAD_SECTION_HASHES[section] || section;
  return hash ? `/leads/${slug}#${hash}` : `/leads/${slug}`;
}

export function getLeadStatusHref(slug, status) {
  switch (String(status || "")) {
    case "NEW":
    case "CONTACTED":
      return buildLeadHref(slug, "workflow");
    case "QUALIFIED":
      return buildLeadHref(slug, "estimate");
    case "MEETING":
      return buildLeadHref(slug, "measurements");
    case "PROPOSAL":
      return buildLeadHref(slug, "followups");
    case "WON":
      return buildLeadHref(slug, "production");
    case "LOST":
      return buildLeadHref(slug, "history");
    default:
      return buildLeadHref(slug, "summary");
  }
}

export function getLeadAppointmentHref(item) {
  return buildLeadHref(item?.slug, "measurements");
}

export function getLeadFollowupHref(item) {
  return buildLeadHref(item?.slug, "followups");
}

export function getLeadTaskHref(item) {
  const text = normalizeText(
    item?.title,
    item?.tag,
    item?.lane,
    item?.note,
    item?.lead
  );

  if (!item?.slug) {
    return null;
  }

  if (
    text.includes("черт") ||
    text.includes("эскиз") ||
    text.includes("проект")
  ) {
    return buildLeadHref(item.slug, "drawings");
  }

  if (
    text.includes("смет") ||
    text.includes("расч") ||
    text.includes("кп")
  ) {
    return buildLeadHref(item.slug, "estimate");
  }

  if (
    text.includes("замер") ||
    text.includes("выезд") ||
    text.includes("шоурум") ||
    text.includes("консультац")
  ) {
    return buildLeadHref(item.slug, "measurements");
  }

  if (
    text.includes("предоплат") ||
    text.includes("производ") ||
    text.includes("распил") ||
    text.includes("сборк") ||
    text.includes("монтаж") ||
    text.includes("установ")
  ) {
    return buildLeadHref(item.slug, "production");
  }

  if (
    text.includes("возврат") ||
    text.includes("дожим") ||
    text.includes("согласован")
  ) {
    return buildLeadHref(item.slug, "followups");
  }

  if (
    text.includes("ответ") ||
    text.includes("контакт") ||
    text.includes("созвон") ||
    text.includes("лид")
  ) {
    return buildLeadHref(item.slug, "workflow");
  }

  return buildLeadHref(item.slug, "project");
}

export function getLeadAlertHref(item) {
  const text = normalizeText(item?.action, item?.detail, item?.lead);

  if (!item?.slug) {
    return null;
  }

  if (
    text.includes("новая заявка") ||
    text.includes("без ответа") ||
    text.includes("первый контакт")
  ) {
    return buildLeadHref(item.slug, "workflow");
  }

  if (
    text.includes("замер") ||
    text.includes("выезд") ||
    text.includes("доступ")
  ) {
    return buildLeadHref(item.slug, "measurements");
  }

  if (
    text.includes("кп") ||
    text.includes("смет") ||
    text.includes("расч")
  ) {
    return buildLeadHref(item.slug, "estimate");
  }

  if (
    text.includes("дожим") ||
    text.includes("касани") ||
    text.includes("возврат")
  ) {
    return buildLeadHref(item.slug, "followups");
  }

  return buildLeadHref(item.slug, "history");
}
