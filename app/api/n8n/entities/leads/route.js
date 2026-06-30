import { createLeadFromN8n, updateLeadFromN8n } from '@/lib/n8n/entity-handlers/leads';
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
    const { action, data } = body;

    if (!['create', 'update'].includes(action)) {
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

    let result;
    if (action === 'create') {
      result = await createLeadFromN8n(data);
    } else {
      result = await updateLeadFromN8n(data);
    }

    return Response.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-leads] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
