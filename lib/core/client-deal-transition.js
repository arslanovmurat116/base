function normalizeText(value) {
  return String(value || "").trim();
}

function toSlug(value, fallback = "deal") {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function parseAmount(value) {
  const digits = String(value || "").replace(/[^\d.,-]+/g, "").replace(",", ".");
  const amount = Number.parseFloat(digits);
  return Number.isFinite(amount) ? amount : null;
}

function deriveDealStageKey(status) {
  switch (String(status || "").toUpperCase()) {
    case "NEW":
      return "new";
    case "CONTACTED":
      return "contacted";
    case "QUALIFIED":
      return "qualified";
    case "MEETING":
      return "appointment";
    case "PROPOSAL":
      return "proposal";
    case "WON":
      return "won";
    case "LOST":
      return "lost";
    default:
      return "new";
  }
}

function deriveClientStatus(lead) {
  if (lead?.status === "WON") {
    return "ACTIVE";
  }

  if (lead?.status === "LOST") {
    return "INACTIVE";
  }

  return "PROSPECT";
}

export function deriveClientCandidateFromLead(lead = {}) {
  const displayName = normalizeText(lead.name || lead.fullName || lead.client?.name) || "Client";
  const primaryPhone = normalizeText(lead.phone || lead.client?.phone) || null;
  const telegramUsername = normalizeText(lead.telegramUsername || lead.telegram_username) || null;
  const telegramUserId = normalizeText(lead.telegramUserId || lead.telegram_user_id) || null;

  return {
    source: "lead_projection",
    legacyLeadId: lead.id || null,
    legacyLeadSlug: lead.slug || null,
    displayName,
    primaryPhone,
    telegramUsername,
    telegramUserId,
    status: deriveClientStatus(lead),
    ownerName: normalizeText(lead.manager || lead.deal?.responsible) || null,
    readiness:
      displayName && (primaryPhone || telegramUserId || telegramUsername) ? "high" : "medium"
  };
}

export function deriveDealCandidateFromLead(lead = {}) {
  const subject =
    normalizeText(
      lead.product ||
        lead.requestType ||
        lead.deal?.productType ||
        lead.order?.projectType ||
        lead.summary
    ) || "New business case";
  const amountEstimate =
    parseAmount(lead.finalAmount) ||
    parseAmount(lead.estimateRange) ||
    parseAmount(lead.deal?.finalAmount) ||
    null;

  return {
    source: "lead_projection",
    legacyLeadId: lead.id || null,
    legacyLeadSlug: lead.slug || null,
    title: `${subject} · ${normalizeText(lead.name || lead.client?.name) || "Client"}`,
    key: toSlug(`${lead.slug || lead.id || "lead"}-${subject}`, "deal"),
    pipelineKey: "sales",
    stageKey: deriveDealStageKey(lead.status),
    status:
      String(lead.status || "").toUpperCase() === "LOST"
        ? "CLOSED_LOST"
        : String(lead.status || "").toUpperCase() === "WON"
          ? "CLOSED_WON"
          : "OPEN",
    ownerName: normalizeText(lead.manager || lead.deal?.responsible) || null,
    amountEstimate,
    currency: amountEstimate ? "KZT" : null,
    readiness: "prepared"
  };
}

export function buildLeadCoreProjection(lead = {}, options = {}) {
  const clientRecord = options.clientRecord || lead.boseCore?.client || null;
  const dealRecord = options.dealRecord || lead.boseCore?.deal || null;
  const hasCoreRecords = Boolean(clientRecord || dealRecord);

  return {
    moduleHint: "furneq",
    leadRef: {
      legacyId: lead.id || null,
      legacySlug: lead.slug || null,
      status: lead.status || "NEW"
    },
    clientCandidate: deriveClientCandidateFromLead(lead),
    dealCandidate: deriveDealCandidateFromLead(lead),
    clientRecord,
    dealRecord,
    readModelState: hasCoreRecords ? "live-core-records" : "lead-candidates-only",
    migrationState: hasCoreRecords
      ? "dual-write-with-core-records"
      : "lead-centric-with-core-candidates"
  };
}
