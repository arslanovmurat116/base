import { db } from '@/lib/db';

/**
 * Создание встречи/назначения из n8n
 */
export async function createAppointmentFromN8n(data) {
  const {
    company_id,
    lead_id,
    title,
    description,
    start_time,
    end_time,
    location,
    participants = [],
    calendar_type = 'meeting'
  } = data;

  if (!company_id || !title || !start_time) {
    throw new Error('company_id, title, and start_time are required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `INSERT INTO appointments (company_id, lead_id, title, description, start_time, end_time, location, participants, calendar_type, created_from_n8n)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [
        company_id,
        lead_id || null,
        title,
        description,
        start_time,
        end_time || null,
        location,
        JSON.stringify(participants),
        calendar_type
      ]
    );

    await client.end();
    return result.rows[0];
  } catch (error) {
    console.error('[n8n-appointments] Error creating appointment:', error);
    throw error;
  }
}

/**
 * Обновление встречи из n8n
 */
export async function updateAppointmentFromN8n(data) {
  const { id, title, description, start_time, end_time, location, status } = data;

  if (!id) {
    throw new Error('id is required for update');
  }

  try {
    const client = await db();

    const updates = [];
    const params = [id];
    let paramCount = 2;

    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (start_time !== undefined) {
      updates.push(`start_time = $${paramCount}`);
      params.push(start_time);
      paramCount++;
    }

    if (end_time !== undefined) {
      updates.push(`end_time = $${paramCount}`);
      params.push(end_time);
      paramCount++;
    }

    if (location !== undefined) {
      updates.push(`location = $${paramCount}`);
      params.push(location);
      paramCount++;
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE appointments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await client.query(query, params);

    await client.end();

    if (result.rows.length === 0) {
      throw new Error(`Appointment with id ${id} not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('[n8n-appointments] Error updating appointment:', error);
    throw error;
  }
}
