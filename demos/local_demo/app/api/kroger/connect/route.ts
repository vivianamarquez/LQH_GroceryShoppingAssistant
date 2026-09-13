import {
  cookie,
  getAuthorizeUrl,
  getClientId,
  getRedirectUri,
} from '@/lib/kroger';

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function GET(request: Request) {
  try {
    const state = base64Url(crypto.getRandomValues(new Uint8Array(24)));
    const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(verifier),
    );
    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: getRedirectUri(request),
      response_type: 'code',
      scope: 'cart.basic:write',
      state,
      code_challenge: base64Url(new Uint8Array(digest)),
      code_challenge_method: 'S256',
    });
    const response = new Response(null, {
      status: 302,
      headers: { Location: `${getAuthorizeUrl()}?${params}` },
    });
    response.headers.append(
      'Set-Cookie',
      cookie(request, 'kroger_oauth_state', state, 600),
    );
    response.headers.append(
      'Set-Cookie',
      cookie(request, 'kroger_code_verifier', verifier, 600),
    );
    return response;
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Kroger sign-in.',
      },
      { status: 500 },
    );
  }
}
