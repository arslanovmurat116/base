import { FURNEQ_MODULE } from "./furneq/manifest";

const MODULE_REGISTRY = Object.freeze([FURNEQ_MODULE]);

export function listRegisteredModules() {
  return MODULE_REGISTRY;
}

export function getRegisteredModule(moduleId) {
  return MODULE_REGISTRY.find((module) => module.id === moduleId) || null;
}

