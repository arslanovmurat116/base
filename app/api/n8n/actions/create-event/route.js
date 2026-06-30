import { createBusinessEventFromN8n } from '@/lib/n8n/action-handlers/events';
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
    const { eventType, aggregateId, aggregateType, payload, leadId } = body;

    if (!eventType || !aggregateId) {
      return Response.json(
        { error: 'eventType and aggregateId are required' },
        { status: 400 }
      );
    }

    const result = await createBusinessEventFromN8n({
      eventType,
      aggregateId,
      aggregateType: aggregateType || 'lead',
      payload: payload || {},
      leadId,
      sourceWorkflow: 'n8n'
    });

    return Response.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-create-event] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
