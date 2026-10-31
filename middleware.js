import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/find-account', '/appeal'];
const AUTH_COOKIE_NAME = 'authToken';

async function isTokenValid(token) {
  if (!token) return false;
  try {
    const encoder = new TextEncoder();
    await jwtVerify(token, encoder.encode(process.env.JWT_SECRET));
    return true;
  } catch (error) {
    return false;
  }
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const authenticated = await isTokenValid(token);
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!authenticated && !isPublicPath) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (authenticated && isPublicPath) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // sw.js, manifest.json et les icones doivent rester accessibles sans
  // authentification : le Service Worker est enregistre des le chargement
  // de l'app (y compris sur /login), et le manifeste/les icones sont
  // references par le navigateur independamment de la session.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|uploads|sw.js|manifest.json|icon.*\\.png|apple-touch-icon.png).*)']
};
