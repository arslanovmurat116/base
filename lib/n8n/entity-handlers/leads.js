import { db } from '@/lib/db';

/**
 * Создание лида из n8n
 */
export async function createLeadFromN8n(data) {
  const {
    company_id,
    name,
    email,
    phone,
    description,
    stage = 'new',
    tags = []
  } = data;

  if (!company_id || !name) {
    throw new Error('company_id and name are required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `INSERT INTO leads (company_id, name, email, phone, description, stage, tags, created_from_n8n)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING *`,
      [company_id, name, email, phone, description, stage, JSON.stringify(tags)]
    );

    await client.end();
    return result.rows[0];
  } catch (error) {
    console.error('[n8n-leads] Error creating lead:', error);
    throw error;
  }
}

/**
 * Обновление лида из n8n
 */
export async function updateLeadFromN8n(data) {
  const { id, name, email, phone, description, stage, tags } = data;

  if (!id) {
    throw new Error('id is required for update');
  }

  try {
    const client = await db();

    const updates = [];
    const params = [id];
    let paramCount = 2;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      params.push(name);
      paramCount++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      params.push(email);
      paramCount++;
    }

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount}`);
      params.push(phone);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (stage !== undefined) {
      updates.push(`stage = $${paramCount}`);
      params.push(stage);
      paramCount++;
    }

    if (tags !== undefined) {
      updates.push(`tags = $${paramCount}`);
      params.push(JSON.stringify(tags));
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await client.query(query, params);

    await client.end();

    if (result.rows.length === 0) {
      throw new Error(`Lead with id ${id} not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('[n8n-leads] Error updating lead:', error);
    throw error;
  }
}
