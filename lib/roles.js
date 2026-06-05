export function normalizeRole(role) {
  const normalized = String(role || "").trim().toLowerCase();

  if (["manager", "менеджер"].includes(normalized)) {
    return "manager";
  }

  if (["operator", "measurer", "замерщик"].includes(normalized)) {
    return "operator";
  }

  if (["owner", "director", "директор", "собственник"].includes(normalized)) {
    return "owner";
  }

  return "owner";
}

export function canSeeOwnerPages(role) {
  return normalizeRole(role) === "owner";
}
