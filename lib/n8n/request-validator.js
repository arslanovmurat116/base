/**
 * Валидация входящего запроса от n8n
 */
export async function validateN8nRequest(request) {
  try {
    // Проверка API ключа (опционально)
    const apiKey = request.headers.get('x-n8n-api-key');
    const expectedApiKey = process.env.N8N_API_KEY;

    if (expectedApiKey && apiKey !== expectedApiKey) {
      return {
        valid: false,
        error: 'Invalid or missing API key',
        statusCode: 401
      };
    }

    // Проверка метода
    if (request.method !== 'POST') {
      return {
        valid: false,
        error: `Method ${request.method} not allowed`,
        statusCode: 405
      };
    }

    // Проверка Content-Type
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        valid: false,
        error: 'Content-Type must be application/json',
        statusCode: 400
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      statusCode: 500
    };
  }
}
