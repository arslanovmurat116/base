import { createTaskFromN8n, completeTaskFromN8n } from '@/lib/n8n/entity-handlers/tasks';
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

    if (!['create', 'complete'].includes(action)) {
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }

    let result;
    if (action === 'create') {
      result = await createTaskFromN8n(data);
    } else {
      result = await completeTaskFromN8n(data);
    }

    return Response.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[n8n-tasks] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
