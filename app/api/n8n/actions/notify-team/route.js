import { notifyTeamFromN8n } from '@/lib/n8n/action-handlers/notifications';
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
    const { notificationType, recipients, message, metadata } = body;

    if (!notificationType || !message) {
      return Response.json(
        { error: 'notificationType and message are required' },
        { status: 400 }
      );
    }

    const result = await notifyTeamFromN8n({
      notificationType,
      recipients: recipients || ['all'], // all, directors, managers, specific_user_ids
      message,
      metadata,
      sourceWorkflow: 'n8n'
    });

    return Response.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-notify-team] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
