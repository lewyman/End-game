export default function handler(req: Request): Response {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/hello-zo')) {
    return new Response(JSON.stringify({ msg: 'Hello from Zo' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  if (url.pathname.startsWith('/api/status')) {
    return new Response(JSON.stringify({ ok: true, path: url.pathname }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}
