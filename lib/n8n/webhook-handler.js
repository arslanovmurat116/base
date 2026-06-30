/**
 * Главный webhook handler для n8n
 * Распределяет события по типам
 */
export async function handleN8nWebhook(payload) {
  const { event_type, data } = payload;

  console.log(`[n8n-handler] Processing event: ${event_type}`);

  // Динамический импорт обработчиков
  const handlers = {
    'lead_created': () => handleLeadCreated(data),
    'lead_updated': () => handleLeadUpdated(data),
    'deal_created': () => handleDealCreated(data),
    'deal_updated': () => handleDealUpdated(data),
    'task_assigned': () => handleTaskAssigned(data),
    'task_completed': () => handleTaskCompleted(data),
    'appointment_created': () => handleAppointmentCreated(data),
    'appointment_updated': () => handleAppointmentUpdated(data),
    'message_sent': () => handleMessageSent(data),
    'notification': () => handleNotification(data)
  };

  const handler = handlers[event_type];
  if (!handler) {
    throw new Error(`Unknown event type: ${event_type}`);
  }

  return handler();
}

async function handleLeadCreated(data) {
  console.log('[n8n-handler] Creating lead from n8n:', data);
  // Импортируем обработчик
  const { createLeadFromN8n } = await import('./entity-handlers/leads.js');
  return createLeadFromN8n(data);
}

async function handleLeadUpdated(data) {
  console.log('[n8n-handler] Updating lead from n8n:', data);
  const { updateLeadFromN8n } = await import('./entity-handlers/leads.js');
  return updateLeadFromN8n(data);
}

async function handleDealCreated(data) {
  console.log('[n8n-handler] Creating deal from n8n:', data);
  const { createDealFromN8n } = await import('./entity-handlers/deals.js');
  return createDealFromN8n(data);
}

async function handleDealUpdated(data) {
  console.log('[n8n-handler] Updating deal from n8n:', data);
  const { updateDealFromN8n } = await import('./entity-handlers/deals.js');
  return updateDealFromN8n(data);
}

async function handleTaskAssigned(data) {
  console.log('[n8n-handler] Creating task from n8n:', data);
  const { createTaskFromN8n } = await import('./entity-handlers/tasks.js');
  return createTaskFromN8n(data);
}

async function handleTaskCompleted(data) {
  console.log('[n8n-handler] Completing task from n8n:', data);
  const { completeTaskFromN8n } = await import('./entity-handlers/tasks.js');
  return completeTaskFromN8n(data);
}

async function handleAppointmentCreated(data) {
  console.log('[n8n-handler] Creating appointment from n8n:', data);
  const { createAppointmentFromN8n } = await import('./entity-handlers/appointments.js');
  return createAppointmentFromN8n(data);
}

async function handleAppointmentUpdated(data) {
  console.log('[n8n-handler] Updating appointment from n8n:', data);
  const { updateAppointmentFromN8n } = await import('./entity-handlers/appointments.js');
  return updateAppointmentFromN8n(data);
}

async function handleMessageSent(data) {
  console.log('[n8n-handler] Processing message from n8n:', data);
  const { sendTelegramFromN8n } = await import('./action-handlers/telegram.js');
  return sendTelegramFromN8n(data);
}

async function handleNotification(data) {
  console.log('[n8n-handler] Processing notification from n8n:', data);
  const { notifyTeamFromN8n } = await import('./action-handlers/notifications.js');
  return notifyTeamFromN8n(data);
}
