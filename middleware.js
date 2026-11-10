import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/find-account', '/appeal'];
const AUTH_COOKIE_NAME = 'authToken';
// Pages consultables sans compte : une publication partagee a l'exterieur
// (/post/123) ou une annonce du Market (/market/123). La page elle-meme verifie
// que le contenu est bien public (sinon redirection vers la connexion).
const PUBLIC_PAGE_PATTERNS = [/^\/post\/\d+$/, /^\/market\/\d+$/];

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
  const isPublicPage = PUBLIC_PAGE_PATTERNS.some((pattern) => pattern.test(pathname));

  if (!authenticated && !isPublicPath && !isPublicPage) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Account Center : "ajouter un compte" ouvre la page de connexion meme
  // quand une session est deja active (/login?add=1).
  const isAddAccount = pathname === '/login' && request.nextUrl.searchParams.get('add') === '1';

  if (authenticated && isPublicPath && !isAddAccount) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // sw.js, manifest.json et les icones doivent rester accessibles sans
  // authentification : le Service Worker est enregistre des le chargement
  // de l'app (y compris sur /login), et le manifeste/les icones sont
  // references par le navigateur independamment de la session.
  matcher: ['/((?!api|_next/static|_next/image|favicon.*|logo.png|uploads|sw.js|manifest.json|icon.*\\.png|apple-touch-icon.png).*)']
};
