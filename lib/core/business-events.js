const LEGACY_LEAD_EVENT_NAME_MAP = Object.freeze({
  lead_created: "LeadCreated",
  manager_assigned: "LeadManagerAssigned",
  telegram_message_received: "MessageReceived",
  safe_auto_reply_sent: "SafeAutoReplySent",
  bot_context_reply_sent: "BotContextReplySent",
  lead_intake_started: "LeadIntakeStarted",
  lead_intake_progressed: "LeadIntakeProgressed",
  lead_intake_completed: "LeadIntakeCompleted",
  task_created: "TaskCreated",
  task_completed: "TaskCompleted",
  followup_created: "FollowupScheduled",
  followup_completed: "FollowupCompleted",
  manager_outcome_logged: "LeadOutcomeLogged",
  manager_reply_sent: "ManagerReplySent",
  appointment_created: "AppointmentCreated",
  appointment_status_updated: "AppointmentStatusUpdated",
  appointment_reminder_sent: "AppointmentReminderSent",
  appointment_template_sent: "AppointmentTemplateSent",
  appointment_followthrough_logged: "AppointmentFollowthroughLogged",
  lead_workflow_updated: "LeadWorkflowUpdated",
  lead_order_context_updated: "LeadModuleContextUpdated",
  lead_lost_reason_saved: "LeadLostReasonSaved",
  first_response_reminder_sent: "FirstResponseReminderSent"
});

function inferActorType(eventType) {
  if (String(eventType || "").startsWith("manager_")) {
    return "user";
  }

  return "system";
}

export function mapLegacyLeadEventName(eventType) {
  return LEGACY_LEAD_EVENT_NAME_MAP[eventType] || "LeadEventCaptured";
}

export function buildBusinessEvent({
  companyId,
  aggregateType,
  aggregateId,
  eventName,
  payload = {},
  actorType = "system",
  actorId = null,
  channel = null,
  causationId = null,
  correlationId = null,
  eventVersion = 1,
  occurredAt = null
}) {
  return {
    companyId,
    aggregateType,
    aggregateId,
    eventName,
    eventVersion,
    actorType,
    actorId,
    channel,
    causationId,
    correlationId,
    payload,
    occurredAt: occurredAt || new Date().toISOString()
  };
}

export async function appendBusinessEvent(event, executor) {
  if (!event?.companyId || !event?.aggregateType || !event?.aggregateId || !event?.eventName) {
    return {
      ok: false,
      skipped: true,
      reason: "missing_event_fields"
    };
  }

  if (typeof executor !== "function") {
    return {
      ok: false,
      skipped: true,
      reason: "missing_executor"
    };
  }

  try {
    await executor(
      `
        insert into business_events (
          company_id,
          aggregate_type,
          aggregate_id,
          event_name,
          event_version,
          actor_type,
          actor_id,
          channel,
          causation_id,
          correlation_id,
          payload,
          occurred_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::timestamptz)
      `,
      [
        event.companyId,
        event.aggregateType,
        String(event.aggregateId),
        event.eventName,
        Number(event.eventVersion || 1),
        event.actorType || "system",
        event.actorId ? String(event.actorId) : null,
        event.channel || null,
        event.causationId || null,
        event.correlationId || null,
        JSON.stringify(event.payload || {}),
        event.occurredAt || new Date().toISOString()
      ]
    );

    return {
      ok: true,
      skipped: false
    };
  } catch (error) {
    if (error?.code === "42P01" || /business_events/i.test(String(error?.message || ""))) {
      return {
        ok: false,
        skipped: true,
        reason: "business_events_not_ready"
      };
    }

    return {
      ok: false,
      skipped: true,
      reason: error.message
    };
  }
}

export async function appendBusinessEventFromLegacyLeadEvent({
  companyId,
  leadId,
  eventType,
  payload = {},
  executor
}) {
  return appendBusinessEvent(
    buildBusinessEvent({
      companyId,
      aggregateType: "lead",
      aggregateId: leadId,
      eventName: mapLegacyLeadEventName(eventType),
      payload: {
        legacyEventType: eventType,
        ...payload
      },
      actorType: inferActorType(eventType),
      channel:
        String(eventType || "").includes("telegram") || payload?.channel === "telegram"
          ? "telegram"
          : null
    }),
    executor
  );
}

