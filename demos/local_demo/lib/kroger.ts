const API_URL = process.env.KROGER_API_URL ?? 'https://api.kroger.com/v1';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error_description?: string;
};

let cachedToken: { value: string; expiresAt: number } | undefined;

function credentials() {
  const clientId = process.env.KROGER_CLIENT_ID ?? process.env.kroger_client_id;
  const clientSecret =
    process.env.KROGER_CLIENT_SECRET ?? process.env.kroger_client_secret;

  if (!clientId || !clientSecret) {
    throw new Error('Kroger credentials are missing from demos/local_demo/.env.local.');
  }
  return { clientId, clientSecret };
}

function basicAuthorization() {
  const { clientId, clientSecret } = credentials();
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch(`${API_URL}/connect/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: basicAuthorization(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = (await response.json()) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description ?? 'Kroger authentication failed.');
  }
  return data;
}

export async function getAppToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const token = await tokenRequest(
    new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'product.compact',
    }),
  );
  cachedToken = {
    value: token.access_token as string,
    expiresAt: Date.now() + (token.expires_in ?? 1_800) * 1_000,
  };
  return cachedToken.value;
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  verifier: string,
) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  );
}

export function getClientId() {
  return credentials().clientId;
}

export function getRedirectUri(request: Request) {
  return (
    process.env.KROGER_REDIRECT_URI ??
    new URL('/api/kroger/callback', request.url).toString()
  );
}

export function getAuthorizeUrl() {
  return `${API_URL}/connect/oauth2/authorize`;
}

export async function krogerFetch<T>(
  path: string,
  token: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  let data: Record<string, unknown> | undefined;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`Kroger returned ${response.status} with an unexpected response.`);
  }

  if (path === '/cart/add') {
    console.info('[kroger cart]', {
      status: response.status,
      requestId:
        response.headers.get('x-correlation-id') ??
        response.headers.get('x-request-id'),
    });
  }

  if (!response.ok) {
    const errors = data?.errors;
    const first = Array.isArray(errors) ? errors[0] : errors;
    const message =
      (first as { reason?: string; error_description?: string } | undefined)
        ?.reason ??
      (first as { reason?: string; error_description?: string } | undefined)
        ?.error_description ??
      (data?.error_description as string | undefined) ??
      `Kroger returned ${response.status}.`;
    throw new Error(message);
  }
  return data as T;
}

export function readCookie(request: Request, name: string) {
  const header = request.headers.get('cookie') ?? '';
  const value = header
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
  try {
    return value ? decodeURIComponent(value) : undefined;
  } catch {
    return undefined;
  }
}

export function cookie(
  request: Request,
  name: string,
  value: string,
  maxAge: number,
) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
