import fetch from 'node-fetch';

/**
 * n8n REST API клиент
 */
export class N8nClient {
  constructor(apiKey, baseUrl = process.env.N8N_BASE_URL || 'http://localhost:5678') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async request(method, endpoint, data = null) {
    const url = `${this.baseUrl}/api/v1${endpoint}`;
    const options = {
      method,
      headers: {
        'X-N8N-API-KEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`n8n API error: ${response.status} - ${responseData.message || 'Unknown error'}`);
      }

      return responseData;
    } catch (error) {
      console.error(`[n8n-client] Error calling ${url}:`, error);
      throw error;
    }
  }

  /**
   * Получить список всех workflows
   */
  async getWorkflows() {
    return this.request('GET', '/workflows');
  }

  /**
   * Получить workflow по ID
   */
  async getWorkflow(workflowId) {
    return this.request('GET', `/workflows/${workflowId}`);
  }

  /**
   * Выполнить workflow
   */
  async executeWorkflow(workflowId, data) {
    return this.request('POST', `/workflows/${workflowId}/execute`, data);
  }

  /**
   * Активировать workflow
   */
  async activateWorkflow(workflowId) {
    return this.request('PATCH', `/workflows/${workflowId}`, { active: true });
  }

  /**
   * Деактивировать workflow
   */
  async deactivateWorkflow(workflowId) {
    return this.request('PATCH', `/workflows/${workflowId}`, { active: false });
  }

  /**
   * Создать webhook
   */
  async createWebhook(workflowId, webhookData) {
    return this.request('POST', `/workflows/${workflowId}/webhooks`, webhookData);
  }

  /**
   * Получить webhooks workflow
   */
  async getWebhooks(workflowId) {
    return this.request('GET', `/workflows/${workflowId}/webhooks`);
  }

  /**
   * Удалить webhook
   */
  async deleteWebhook(workflowId, webhookId) {
    return this.request('DELETE', `/workflows/${workflowId}/webhooks/${webhookId}`);
  }

  /**
   * Получить execution history
   */
  async getExecutions(workflowId, limit = 50) {
    return this.request('GET', `/workflows/${workflowId}/executions?limit=${limit}`);
  }

  /**
   * Получить детали execution
   */
  async getExecution(executionId) {
    return this.request('GET', `/executions/${executionId}`);
  }
}
