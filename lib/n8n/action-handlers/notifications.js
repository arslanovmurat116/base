import { db } from '@/lib/db';
import { sendMessageToChat } from '@/lib/telegram-control';
import { logN8nIntegration } from '@/lib/n8n/logging';

/**
 * Отправка уведомления команде из n8n
 */
export async function notifyTeamFromN8n(data) {
  const { notificationType, recipients = ['all'], message, metadata = {}, sourceWorkflow = 'n8n' } = data;

  if (!notificationType || !message) {
    throw new Error('notificationType and message are required');
  }

  try {
    const client = await db();

    let userIds = [];

    // Определяем получателей
    if (recipients.includes('all')) {
      const result = await client.query('SELECT id FROM users WHERE active = true');
      userIds = result.rows.map(r => r.id);
    } else if (recipients.includes('directors')) {
      const result = await client.query(
        'SELECT u.id FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role_id IN (SELECT id FROM roles WHERE name = \'director\')');
      userIds = result.rows.map(r => r.id);
    } else if (recipients.includes('managers')) {
      const result = await client.query(
        'SELECT u.id FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE ur.role_id IN (SELECT id FROM roles WHERE name = \'manager\')');
      userIds = result.rows.map(r => r.id);
    } else {
      // Конкретные пользователи
      userIds = recipients.filter(r => !isNaN(r)).map(Number);
    }

    // Отправляем уведомление
    const notificationResult = await client.query(
      `INSERT INTO notifications (type, message, metadata, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [notificationType, message, JSON.stringify(metadata)]
    );

    const notification = notificationResult.rows[0];

    // Ассоциируем уведомление с пользователями
    for (const userId of userIds) {
      await client.query(
        'INSERT INTO notification_users (notification_id, user_id) VALUES ($1, $2)',
        [notification.id, userId]
      );
    }

    await client.end();

    await logN8nIntegration({
      event_type: 'team_notification_sent',
      status: 'SUCCESS',
      payload: data,
      result: { notification_id: notification.id, recipient_count: userIds.length }
    });

    return {
      notification_id: notification.id,
      recipient_count: userIds.length,
      message: 'Notification sent successfully'
    };
  } catch (error) {
    console.error('[n8n-notifications] Error sending notification:', error);

    await logN8nIntegration({
      event_type: 'team_notification_sent',
      status: 'ERROR',
      payload: data,
      error: error.message
    }).catch(() => null);

    throw error;
  }
}
