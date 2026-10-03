import http from 'node:http';

// Starts a local HTTP server. `handler` gets { method, path, headers, body } and returns
// { status?, json? , bytes? }. Every request is kept in `requests` for assertions.
export async function startServer(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const request = { method: req.method, path: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
    requests.push(request);
    const { status = 200, json, bytes } = await handler(request);
    res.writeHead(status, { 'content-type': bytes ? 'application/octet-stream' : 'application/json' });
    res.end(bytes ?? JSON.stringify(json ?? {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export function geminiReply(text) {
  return { json: { candidates: [{ content: { parts: [{ text }] } }] } };
}
