import { sendMessageToChat } from '@/lib/telegram-control';
import { logN8nIntegration } from '@/lib/n8n/logging';

/**
 * Отправка сообщения в Telegram из n8n
 */
export async function sendTelegramFromN8n(data) {
  const { chatId, message, replyMarkup, leadId, sourceWorkflow } = data;

  if (!chatId || !message) {
    throw new Error('chatId and message are required');
  }

  try {
    const result = await sendMessageToChat(chatId, message, replyMarkup);

    await logN8nIntegration({
      event_type: 'telegram_message_sent',
      status: 'SUCCESS',
      payload: { chatId, message, leadId },
      result
    });

    return result;
  } catch (error) {
    console.error('[n8n-telegram] Error sending message:', error);

    await logN8nIntegration({
      event_type: 'telegram_message_sent',
      status: 'ERROR',
      payload: { chatId, message, leadId },
      error: error.message
    }).catch(() => null);

    throw error;
  }
}
