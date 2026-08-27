export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedStr = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  const allowed = allowedStr.split(',').map((x) => x.trim()).filter(Boolean);

  let allowedOrigin = '*';
  if (allowed.length > 0) {
    if (origin && (allowed.includes(origin) || allowed.includes('*'))) {
      allowedOrigin = origin;
    } else {
      allowedOrigin = allowed[0];
    }
  } else if (origin) {
    allowedOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}
