import Document, { Html, Head, Main, NextScript } from 'next/document';
import { LANG_COOKIE, getLocaleMeta, normalizeLocale } from '@/lib/i18n/config';
import { parseCookieHeader } from '@/lib/i18n/server';

export default class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx);
    const req = ctx.req;
    const cookies = parseCookieHeader(req?.headers?.cookie);
    const code = normalizeLocale(cookies[LANG_COOKIE]) || 'fr';
    return { ...initialProps, localeCode: code };
  }

  render() {
    const meta = getLocaleMeta(this.props.localeCode);
    return (
    <Html lang={meta.htmlLang} dir={meta.dir}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script
          // Applique le dernier theme connu avant le premier affichage (pas de flash clair).
          dangerouslySetInnerHTML={{
            __html: "try{if(localStorage.getItem('nx-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}"
          }}
        />
        <meta name="theme-color" content="#F2F7FA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#070C11" media="(prefers-color-scheme: dark)" />
        <link rel="icon" href="/icon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
  }
}
