import { NextResponse, type NextRequest } from 'next/server';

const KIOSK = 'irb_kiosk';
const KIOSK_OK = new Set(['/fuegos', '/offline']);

/**
 * - Pasa la ruta al layout del curso (x-pathname) para que renderice en el servidor la clase actual.
 * - Da una identidad anónima a quien abre una práctica gratuita sin cuenta (XP y presencia sin login).
 * - Enlace público /fuegos: quien llega por ahí sin sesión queda marcado y cualquier otra página lo devuelve a /fuegos.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const signedIn = !!req.cookies.get('irb_session');
  const isFile = /\.[a-z0-9]+$/i.test(path);
  if (!signedIn && !isFile && !KIOSK_OK.has(path) && req.cookies.get(KIOSK)) {
    // detrás de nginx nextUrl apunta a localhost:4200: se usa el host público que reenvía el proxy
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'staging-academia.irbximena.com';
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    const res = NextResponse.redirect(new URL('/fuegos', `${proto}://${host}`), 307);
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }
  const headers = new Headers(req.headers);
  headers.set('x-pathname', path);
  const res = NextResponse.next({ request: { headers } });
  const secure = req.nextUrl.protocol === 'https:';
  if (!req.cookies.get('irb_anon') && !signedIn) {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    res.cookies.set('irb_anon', id, { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  if (path === '/fuegos' && !signedIn && !req.cookies.get(KIOSK)) res.cookies.set(KIOSK, '1', { httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: 60 * 60 * 24 * 90 });
  return res;
}

export const config = { matcher: ['/((?!_next/|api/|icons/|sw.js|manifest.webmanifest|favicon).*)'] };
