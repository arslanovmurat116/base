import {
  canAccessOwnerScope,
  getCoreRoleLabel,
  getTelegramRoleLabel,
  mapCoreRoleToTelegramRole,
  mapTelegramRoleToCoreRole,
  normalizeCoreRole,
  normalizeTelegramSurfaceRole
} from "./core/roles";

export function normalizeRole(role) {
  return normalizeCoreRole(role, "owner");
}

export function canSeeOwnerPages(role) {
  return canAccessOwnerScope(role);
}

export {
  getCoreRoleLabel,
  getTelegramRoleLabel,
  mapCoreRoleToTelegramRole,
  mapTelegramRoleToCoreRole,
  normalizeTelegramSurfaceRole
};
