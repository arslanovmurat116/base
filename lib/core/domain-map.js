const CORE_ENTITY_DEFINITIONS = Object.freeze({
  company: {
    code: "company",
    title: "Company",
    status: "implemented",
    purpose: "Tenant and workspace boundary for the whole BOSE system.",
    fields: [
      "id",
      "slug",
      "name",
      "timezone",
      "language",
      "status",
      "plan",
      "createdAt",
      "updatedAt"
    ],
    relations: [
      "users",
      "roles",
      "clients",
      "leads",
      "deals",
      "tasks",
      "followups",
      "appointments",
      "events",
      "settings"
    ],
    currentBacking: ["companies", "system_settings"],
    coreReason: "Every BOSE workspace must be isolated by company."
  },
  user: {
    code: "user",
    title: "User",
    status: "implemented",
    purpose: "Employee, operator, manager, or owner acting inside BOSE.",
    fields: [
      "id",
      "companyId",
      "fullName",
      "email",
      "phone",
      "telegramUserId",
      "telegramUsername",
      "isActive",
      "createdAt"
    ],
    relations: ["company", "roles", "tasks", "appointments", "notifications", "events"],
    currentBacking: ["users", "telegram_subscribers"],
    coreReason: "Any BOSE workflow needs a human actor and assignment target."
  },
  role: {
    code: "role",
    title: "Role",
    status: "prepared",
    purpose: "Unified permission and responsibility model across web and Telegram.",
    fields: [
      "id",
      "companyId",
      "code",
      "name",
      "scope",
      "permissions",
      "isSystem",
      "createdAt",
      "updatedAt"
    ],
    relations: ["users", "notifications"],
    currentBacking: ["users.role", "telegram_subscribers.role"],
    targetBacking: ["roles", "user_roles"],
    coreReason: "BOSE needs one role vocabulary for Telegram, Mini App, and internal flows."
  },
  lead: {
    code: "lead",
    title: "Lead",
    status: "implemented",
    purpose: "Inbound interest or new request before it becomes a stable customer relationship.",
    fields: [
      "id",
      "companyId",
      "assignedUserId",
      "fullName",
      "phone",
      "telegramUsername",
      "source",
      "channel",
      "status",
      "temperature",
      "notes",
      "createdAt",
      "updatedAt"
    ],
    relations: [
      "company",
      "user",
      "client",
      "deal",
      "tasks",
      "followups",
      "appointments",
      "conversation",
      "messages",
      "events"
    ],
    currentBacking: ["leads", "lead_events", "lead_runtime_patches"],
    coreReason: "Lead is the universal intake object for BOSE regardless of industry."
  },
  client: {
    code: "client",
    title: "Client",
    status: "prepared",
    purpose: "Stable customer profile after the initial inbound stage.",
    fields: [
      "id",
      "companyId",
      "sourceLeadId",
      "ownerUserId",
      "displayName",
      "primaryPhone",
      "primaryEmail",
      "telegramUserId",
      "telegramUsername",
      "status",
      "notes",
      "createdAt",
      "updatedAt"
    ],
    relations: ["company", "user", "leads", "deals", "appointments", "conversations"],
    currentBacking: ["lead projection only"],
    targetBacking: ["clients"],
    coreReason: "BOSE cannot stay lead-only if it is meant to become a long-lived business OS."
  },
  deal: {
    code: "deal",
    title: "Deal",
    status: "prepared",
    purpose: "Commercial or operational case that moves through a pipeline.",
    fields: [
      "id",
      "companyId",
      "leadId",
      "clientId",
      "ownerUserId",
      "title",
      "pipelineKey",
      "stageKey",
      "status",
      "currency",
      "amountEstimate",
      "closeTargetAt",
      "payload",
      "createdAt",
      "updatedAt"
    ],
    relations: ["lead", "client", "tasks", "followups", "appointments", "messages", "events"],
    currentBacking: ["lead projection only"],
    targetBacking: ["deals"],
    coreReason: "Deal is the universal pipeline unit for BOSE, while lead remains the intake layer."
  },
  task: {
    code: "task",
    title: "Task",
    status: "implemented",
    purpose: "Work item assigned to a human actor.",
    fields: [
      "id",
      "companyId",
      "entityType",
      "entityId",
      "title",
      "description",
      "assignedUserId",
      "priority",
      "status",
      "dueAt",
      "createdAt",
      "completedAt"
    ],
    relations: ["user", "lead", "deal", "client", "events"],
    currentBacking: ["tasks"],
    coreReason: "Tasks are the operational primitive for any BOSE workflow."
  },
  followup: {
    code: "followup",
    title: "Followup",
    status: "implemented",
    purpose: "Scheduled next contact or commitment checkpoint.",
    fields: [
      "id",
      "companyId",
      "entityType",
      "entityId",
      "assignedUserId",
      "channel",
      "followupType",
      "status",
      "scheduledAt",
      "notes"
    ],
    relations: ["user", "lead", "client", "deal", "events"],
    currentBacking: ["lead_followups"],
    coreReason: "Followups drive revenue and service continuity in every vertical."
  },
  appointment: {
    code: "appointment",
    title: "Appointment",
    status: "implemented",
    purpose: "Scheduled meeting, slot, visit, or field appointment.",
    fields: [
      "id",
      "companyId",
      "entityType",
      "entityId",
      "appointmentType",
      "assignedUserId",
      "scheduledAt",
      "location",
      "status",
      "outcome"
    ],
    relations: ["user", "lead", "client", "deal", "events"],
    currentBacking: ["appointments"],
    coreReason: "Appointments are universal; Furneq measurements are a module-specific scenario on top."
  },
  conversation: {
    code: "conversation",
    title: "Conversation",
    status: "implemented",
    purpose: "Channel thread linking a client interaction with BOSE entities.",
    fields: [
      "id",
      "companyId",
      "entityType",
      "entityId",
      "channel",
      "externalChatId",
      "status",
      "lastMessageAt"
    ],
    relations: ["lead", "client", "deal", "messages"],
    currentBacking: ["lead_conversations"],
    coreReason: "Telegram-first BOSE needs first-class channel threads."
  },
  message: {
    code: "message",
    title: "Message",
    status: "implemented",
    purpose: "Individual message unit inside a conversation.",
    fields: [
      "id",
      "conversationId",
      "direction",
      "senderType",
      "senderId",
      "messageText",
      "payload",
      "createdAt"
    ],
    relations: ["conversation", "lead", "client", "deal", "events"],
    currentBacking: ["lead_messages"],
    coreReason: "Messages are foundational for Telegram, AI context, and future multi-channel BOSE."
  },
  notification: {
    code: "notification",
    title: "Notification",
    status: "partial",
    purpose: "Delivery record for alerts, reminders, digests, and workflow signals.",
    fields: [
      "id",
      "companyId",
      "recipientType",
      "recipientId",
      "channel",
      "notificationType",
      "title",
      "body",
      "entityType",
      "entityId",
      "status",
      "sentAt",
      "readAt"
    ],
    relations: ["users", "roles", "events"],
    currentBacking: ["notification_log", "telegram_dispatch_logs"],
    targetBacking: ["notifications", "notification_deliveries"],
    coreReason: "BOSE must notify through Telegram and future channels in a unified way."
  },
  event: {
    code: "event",
    title: "Event",
    status: "prepared",
    purpose: "Immutable business signal describing something that happened in the system.",
    fields: [
      "id",
      "companyId",
      "aggregateType",
      "aggregateId",
      "eventName",
      "eventVersion",
      "actorType",
      "actorId",
      "channel",
      "causationId",
      "correlationId",
      "payload",
      "occurredAt"
    ],
    relations: [
      "lead",
      "client",
      "deal",
      "task",
      "followup",
      "appointment",
      "conversation",
      "notification"
    ],
    currentBacking: ["lead_events"],
    targetBacking: ["business_events"],
    coreReason: "BOSE needs an event spine for projections, Telegram automation, and AI consumers."
  },
  settings: {
    code: "settings",
    title: "Settings",
    status: "partial",
    purpose: "Config values for company, module, AI, and notification behavior.",
    fields: ["id", "scopeType", "scopeId", "key", "value", "updatedAt"],
    relations: ["company", "modules", "roles", "ai", "notifications"],
    currentBacking: ["system_settings"],
    coreReason: "A multi-company system must be configurable without code forks."
  }
});

export const CORE_ENTITY_KEYS = Object.freeze(Object.keys(CORE_ENTITY_DEFINITIONS));

export function listCoreEntityDefinitions() {
  return CORE_ENTITY_KEYS.map((key) => CORE_ENTITY_DEFINITIONS[key]);
}

export function getCoreEntityDefinition(code) {
  return CORE_ENTITY_DEFINITIONS[String(code || "").trim().toLowerCase()] || null;
}

export function getCoreDomainMap() {
  return CORE_ENTITY_DEFINITIONS;
}

