import { corsHeaders } from './cors.ts';

export function jsonResponse(body: unknown, status = 200, _req?: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function err400(req: Request, msg: string) {
  return jsonResponse({ error: msg }, 400, req);
}

export function err401(req: Request, msg = 'Unauthorized') {
  return jsonResponse({ error: msg }, 401, req);
}

export function err403(req: Request, msg = 'Forbidden') {
  return jsonResponse({ error: msg }, 403, req);
}

export function err404(req: Request, msg = 'Not found') {
  return jsonResponse({ error: msg }, 404, req);
}

export function err429(req: Request, msg = 'Too many requests') {
  return jsonResponse({ error: msg }, 429, req);
}

export function err500(req: Request, msg = 'Internal server error') {
  return jsonResponse({ error: msg }, 500, req);
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
