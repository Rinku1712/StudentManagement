const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function apiRequest(endpoint, options = {}) {
  const { headers: optionHeaders, ...requestOptions } = options;
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(optionHeaders || {}),
    },
    credentials: 'include',
    ...requestOptions,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'string'
        ? payload
        : payload?.message || payload?.error || 'Something went wrong. Please try again.';
    throw new Error(message);
  }

  return payload;
}

export { API_BASE_URL, apiRequest };
