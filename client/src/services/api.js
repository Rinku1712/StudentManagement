const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const API_REQUEST_TIMEOUT_MS = 90_000;
const API_BASE_URL = (
  configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : '')
).replace(/\/+$/, '');

async function apiRequest(endpoint, options = {}) {
  if (!API_BASE_URL) {
    throw new Error('The production API URL is not configured. Set VITE_API_URL to your deployed backend URL.');
  }

  if (import.meta.env.PROD) {
    const { hostname: rawHostname, protocol } = new URL(API_BASE_URL);
    const hostname = rawHostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (
      protocol !== 'https:' ||
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.startsWith('127.') ||
      hostname === '0.0.0.0' ||
      hostname === '::1'
    ) {
      throw new Error('VITE_API_URL must be the HTTPS URL of your deployed backend.');
    }
  }

  const { headers: optionHeaders, ...requestOptions } = options;
  const token = localStorage.getItem('token');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(optionHeaders || {}),
      },
      credentials: 'include',
      ...requestOptions,
      signal: requestOptions.signal || AbortSignal.timeout(API_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw new Error('The server took too long to respond. Please try again.', { cause: error });
    }
    throw new Error('Unable to reach the server. Check your connection and the configured API URL.', {
      cause: error,
    });
  }

  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text();
  let payload = responseText;
  if (contentType.includes('application/json') && responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || 'Something went wrong. Please try again.';
    const error = new Error(message);
    error.status = response.status;
    error.code = typeof payload === 'object' && payload ? payload.code : undefined;
    throw error;
  }

  return payload;
}

export { API_BASE_URL, apiRequest };
