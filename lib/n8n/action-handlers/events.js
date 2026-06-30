import { db } from '@/lib/db';
import { logN8nIntegration } from '@/lib/n8n/logging';

/**
 * Создание бизнес-события из n8n
 */
export async function createBusinessEventFromN8n(data) {
  const {
    eventType,
    aggregateId,
    aggregateType = 'lead',
    payload = {},
    leadId,
    sourceWorkflow = 'n8n'
  } = data;

  if (!eventType || !aggregateId) {
    throw new Error('eventType and aggregateId are required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `INSERT INTO business_events (event_type, aggregate_id, aggregate_type, payload, lead_id, source_workflow, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [eventType, aggregateId, aggregateType, JSON.stringify(payload), leadId || null, sourceWorkflow]
    );

    await client.end();

    await logN8nIntegration({
      event_type: 'business_event_created',
      status: 'SUCCESS',
      payload: data,
      result: result.rows[0]
    });

    return result.rows[0];
  } catch (error) {
    console.error('[n8n-events] Error creating business event:', error);

    await logN8nIntegration({
      event_type: 'business_event_created',
      status: 'ERROR',
      payload: data,
      error: error.message
    }).catch(() => null);

    throw error;
  }
}
