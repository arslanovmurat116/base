import crypto from 'crypto';
import { verifyN8nSignature } from '@/lib/n8n/signature-verify';
import { handleN8nWebhook } from '@/lib/n8n/webhook-handler';
import { logN8nIntegration } from '@/lib/n8n/logging';

export async function POST(request) {
  try {
    const body = await request.json();
    const signature = request.headers.get('x-n8n-signature') || '';
    const n8nInstanceId = request.headers.get('x-n8n-instance-id') || 'unknown';

    // Логирование входящего вебхука
    const webhookId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[n8n-webhook-${webhookId}] Incoming webhook from n8n instance: ${n8nInstanceId}`);
    console.log(`[n8n-webhook-${webhookId}] Event type: ${body.event_type}`);

    // Верификация подписи (если секрет настроен)
    if (process.env.N8N_WEBHOOK_SECRET) {
      if (!verifyN8nSignature(JSON.stringify(body), signature, process.env.N8N_WEBHOOK_SECRET)) {
        await logN8nIntegration({
          event_type: body.event_type,
          status: 'REJECTED',
          reason: 'Invalid signature',
          payload: body
        });
        return Response.json(
          { error: 'Invalid signature', webhookId },
          { status: 401 }
        );
      }
    }

    // Обработка вебхука
    const result = await handleN8nWebhook(body);

    // Логирование успешной обработки
    await logN8nIntegration({
      event_type: body.event_type,
      status: 'SUCCESS',
      result,
      payload: body
    });

    console.log(`[n8n-webhook-${webhookId}] Successfully processed`);

    return Response.json({
      success: true,
      result,
      webhookId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-webhook] Error processing webhook:', error);

    await logN8nIntegration({
      event_type: 'unknown',
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }).catch(() => null);

    return Response.json(
      {
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request) {
  return Response.json({ ok: true }, { status: 200 });
}
