const get = () => localStorage.getItem('token');

async function call(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(get() && { Authorization: 'Bearer ' + get() }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (b) => call('/auth/register', 'POST', b),
  login: (b) => call('/auth/login', 'POST', b),
  books: (params) => call('/books?' + new URLSearchParams(params)),
  facets: () => call('/books/facets'),
  mine: () => call('/books/mine'),
  addBook: (b) => call('/books', 'POST', b),
  deleteBook: (id) => call(`/books/${id}`, 'DELETE'),
  complete: (id) => call(`/books/${id}/complete`, 'POST'),
  request: (id, message) => call(`/books/${id}/requests`, 'POST', { message }),
  incoming: () => call('/requests/incoming'),
  outgoing: () => call('/requests/outgoing'),
  act: (id, action) => call(`/requests/${id}/${action}`, 'POST'), // accept | reject | cancel
};
