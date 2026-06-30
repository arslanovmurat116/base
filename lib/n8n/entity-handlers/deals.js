import { db } from '@/lib/db';

/**
 * Создание сделки из n8n
 */
export async function createDealFromN8n(data) {
  const {
    company_id,
    lead_id,
    name,
    amount,
    currency = 'KZT',
    stage = 'new',
    expected_close_date,
    description,
    owner_id
  } = data;

  if (!company_id || !name || amount === undefined) {
    throw new Error('company_id, name, and amount are required');
  }

  try {
    const client = await db();

    const result = await client.query(
      `INSERT INTO deals (company_id, lead_id, name, amount, currency, stage, expected_close_date, description, owner_id, created_from_n8n)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
      [company_id, lead_id || null, name, amount, currency, stage, expected_close_date || null, description, owner_id || null]
    );

    await client.end();
    return result.rows[0];
  } catch (error) {
    console.error('[n8n-deals] Error creating deal:', error);
    throw error;
  }
}

/**
 * Обновление сделки из n8n
 */
export async function updateDealFromN8n(data) {
  const { id, name, amount, stage, expected_close_date, description } = data;

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

    if (amount !== undefined) {
      updates.push(`amount = $${paramCount}`);
      params.push(amount);
      paramCount++;
    }

    if (stage !== undefined) {
      updates.push(`stage = $${paramCount}`);
      params.push(stage);
      paramCount++;
    }

    if (expected_close_date !== undefined) {
      updates.push(`expected_close_date = $${paramCount}`);
      params.push(expected_close_date);
      paramCount++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramCount}`);
      params.push(description);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE deals SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`;
    const result = await client.query(query, params);

    await client.end();

    if (result.rows.length === 0) {
      throw new Error(`Deal with id ${id} not found`);
    }

    return result.rows[0];
  } catch (error) {
    console.error('[n8n-deals] Error updating deal:', error);
    throw error;
  }
}
