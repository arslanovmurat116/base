import { db } from '@/lib/db';

/**
 * Создание задачи из n8n
 */
export async function createTaskFromN8n(data) {
  const {
    company_id,
    lead_id,
    title,
    description,
    assigned_to,
    due_date,
    priority = 'normal',
    status = 'open'
  } = data;

  if (!company_id || !title) {
    throw new Error('company_id and title are required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `INSERT INTO tasks (company_id, lead_id, title, description, assigned_to, due_date, priority, status, created_from_n8n)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING *`,
      [company_id, lead_id || null, title, description, assigned_to || null, due_date || null, priority, status]
    );

    await client.end();
    return result.rows[0];
  } catch (error) {
    console.error('[n8n-tasks] Error creating task:', error);
    throw error;
  }
}

/**
 * Завершение задачи из n8n
 */
export async function completeTaskFromN8n(data) {
  const { id, completion_notes } = data;

  if (!id) {
    throw new Error('id is required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `UPDATE tasks SET status = 'completed', completed_at = NOW(), notes = $2 WHERE id = $1 RETURNING *`,
      [id, completion_notes || null]
    );

    await client.end();

    if (result.rows.length === 0) {
      throw new Error(`Task with id ${id} not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('[n8n-tasks] Error completing task:', error);
    throw error;
  }
}
