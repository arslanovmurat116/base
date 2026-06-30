import { sendTelegramFromN8n } from '@/lib/n8n/action-handlers/telegram';
import { validateN8nRequest } from '@/lib/n8n/request-validator';

export async function POST(request) {
  try {
    const validation = await validateN8nRequest(request);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: validation.statusCode }
      );
    }

    const body = await request.json();
    const { chatId, message, replyMarkup, leadId } = body;

    if (!chatId || !message) {
      return Response.json(
        { error: 'chatId and message are required' },
        { status: 400 }
      );
    }

    const result = await sendTelegramFromN8n({
      chatId,
      message,
      replyMarkup,
      leadId,
      sourceWorkflow: 'n8n'
    });

    return Response.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-send-telegram] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
