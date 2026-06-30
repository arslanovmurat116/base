import { db } from '@/lib/db';

/**
 * Логирование событий n8n интеграции
 */
export async function logN8nIntegration({
  event_type,
  workflow_id = null,
  status = 'PENDING',
  payload = null,
  result = null,
  error = null,
  reason = null,
  stack = null
}) {
  try {
    const client = await db();

    await client.query(
      `INSERT INTO n8n_integration_log 
       (event_type, workflow_id, status, payload, result, error_message, reason, stack_trace, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        event_type,
        workflow_id,
        status,
        payload ? JSON.stringify(payload) : null,
        result ? JSON.stringify(result) : null,
        error || null,
        reason || null,
        stack || null
      ]
    );

    await client.end();
  } catch (logError) {
    console.error('[n8n-logging] Failed to log integration event:', logError);
    // Не выбрасываем ошибку, чтобы не прервать осн��вную логику
  }
}

/**
 * Получить логи n8n интеграции
 */
export async function getN8nLogs({
  limit = 100,
  offset = 0,
  event_type = null,
  status = null,
  workflow_id = null
} = {}) {
  try {
    const client = await db();

    let query = 'SELECT * FROM n8n_integration_log WHERE 1=1';
    const params = [];

    if (event_type) {
      query += ` AND event_type = $${params.length + 1}`;
      params.push(event_type);
    }

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (workflow_id) {
      query += ` AND workflow_id = $${params.length + 1}`;
      params.push(workflow_id);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await client.query(query, params);
    await client.end();

    return result.rows;
  } catch (error) {
    console.error('[n8n-logging] Failed to retrieve logs:', error);
    throw error;
  }
}
