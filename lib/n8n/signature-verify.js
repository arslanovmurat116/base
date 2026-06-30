import crypto from 'crypto';

/**
 * Верификация HMAC подписи от n8n
 * @param {string} payload - тело запроса (JSON строка)
 * @param {string} signature - подпись из заголовка x-n8n-signature
 * @param {string} secret - секретный ключ из конфига
 * @returns {boolean} - валидна ли подпись
 */
export function verifyN8nSignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.warn('[n8n-verify] Missing signature or secret');
    return false;
  }

  try {
    const hash = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(hash, signature);
  } catch (error) {
    console.error('[n8n-verify] Signature verification failed:', error);
    return false;
  }
}

/**
 * Генерация подписи для отправки данных в n8n
 */
export function generateN8nSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}
