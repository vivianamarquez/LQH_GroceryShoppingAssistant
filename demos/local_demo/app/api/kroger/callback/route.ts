import { cookie, exchangeCode, getRedirectUri, readCookie } from '@/lib/kroger';

function resultPage(message: string, success: boolean) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Kroger connection</title></head><body style="font-family:system-ui;padding:40px;background:#f3f1e9;color:#18211c"><h1>${message}</h1><p>${success ? 'You can return to ListLab.' : 'Close this window and try again.'}</p>${
    success
      ? `<script>window.opener?.postMessage('kroger-connected', window.location.origin);window.close()</script>`
      : ''
  }</body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = readCookie(request, 'kroger_oauth_state');
  const verifier = readCookie(request, 'kroger_code_verifier');

  if (!code || !state || state !== expectedState || !verifier) {
    return new Response(resultPage('Kroger connection failed.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  try {
    const token = await exchangeCode(code, getRedirectUri(request), verifier);
    const response = new Response(resultPage('Kroger connected.', true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    response.headers.append(
      'Set-Cookie',
      cookie(
        request,
        'kroger_user_token',
        token.access_token as string,
        token.expires_in ?? 1_800,
      ),
    );
    response.headers.append(
      'Set-Cookie',
      cookie(request, 'kroger_oauth_state', '', 0),
    );
    response.headers.append(
      'Set-Cookie',
      cookie(request, 'kroger_code_verifier', '', 0),
    );
    return response;
  } catch (error) {
    console.error(error);
    return new Response(resultPage('Kroger connection failed.', false), {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
