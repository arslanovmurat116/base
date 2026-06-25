export const FURNEQ_MODULE = Object.freeze({
  id: "furneq",
  title: "Furneq",
  status: "legacy-core-coupled",
  category: "vertical",
  dependsOn: [
    "company",
    "user",
    "role",
    "lead",
    "client",
    "deal",
    "task",
    "followup",
    "appointment",
    "conversation",
    "message",
    "event"
  ],
  ownsEntities: [
    "measurement",
    "room",
    "furniture_project",
    "estimate",
    "estimate_item",
    "project_asset",
    "material_spec",
    "production_job",
    "installation"
  ],
  currentHotspots: [
    {
      file: "lib/server-data.js",
      responsibility: "Furniture lead projection, project/order context, production and installation overlays."
    },
    {
      file: "lib/project-file-slots.js",
      responsibility: "Furniture-specific project asset slots."
    },
    {
      file: "app/leads/[slug]/page.js",
      responsibility: "Deal card sections for measurements, estimate, project files, and production."
    },
    {
      file: "lib/telegram-control.js",
      responsibility: "Furniture-specific manager intents, measurement flows, and customer request scripts."
    }
  ],
  targetTables: [
    "furneq_measurements",
    "furneq_rooms",
    "furneq_project_contexts",
    "furneq_estimates",
    "furneq_estimate_items",
    "furneq_project_assets",
    "furneq_material_specs",
    "furneq_production_jobs",
    "furneq_installations"
  ],
  telegramSurface: {
    employeeFlows: ["today", "alerts", "appointments", "manager intents"],
    clientFlows: ["request", "status", "estimate", "deposit", "manager"]
  }
});

export function listFurneqIsolationTargets() {
  return FURNEQ_MODULE.currentHotspots;
}

