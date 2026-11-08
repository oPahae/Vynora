import dns from 'dns';
import http from 'http';
import https from 'https';
import { analyzeLink, isPrivateIp, isPrivateHostname, normalizeUrl } from './linkSafety';

// Apercu d'un lien (titre, description, image, logo du site), recupere cote
// serveur avec des protections anti-SSRF : jamais d'adresse privee, y compris
// apres redirection ou resolution DNS (verification au moment de la connexion).

const MAX_BYTES = 600 * 1024;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE = 500;

const cache = new Map();

function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [];
    if (list.length === 0 || list.some((entry) => isPrivateIp(entry.address))) {
      return callback(new Error('Adresse interdite'));
    }
    if (options && options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function fetchHtml(urlString, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (error) {
      reject(new Error('URL invalide'));
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol) || isPrivateHostname(url.hostname)) {
      reject(new Error('URL interdite'));
      return;
    }

    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VynoraLinkPreview/1.0)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en,fr;q=0.8'
        }
      },
      (response) => {
        const status = response.statusCode || 0;
        if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
          response.resume();
          if (redirectsLeft <= 0) {
            reject(new Error('Trop de redirections'));
            return;
          }
          let next;
          try {
            next = new URL(response.headers.location, url).toString();
          } catch (error) {
            reject(new Error('Redirection invalide'));
            return;
          }
          fetchHtml(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const type = String(response.headers['content-type'] || '');
        if (status < 200 || status >= 300 || !/text\/html|application\/xhtml/i.test(type)) {
          response.resume();
          reject(new Error('Contenu non supporte'));
          return;
        }

        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            // On a assez de contenu pour lire l'en-tete de la page.
            chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (size - MAX_BYTES))));
            response.destroy();
            return;
          }
          chunks.push(chunk);
        });
        const finish = () => resolve({ html: Buffer.concat(chunks).toString('utf8'), finalUrl: url.toString() });
        response.on('end', finish);
        response.on('close', finish);
        response.on('error', () => finish());
      }
    );
    request.on('timeout', () => request.destroy(new Error('Delai depasse')));
    request.on('error', reject);
    request.end();
  });
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/\s+/g, ' ')
    .trim();
}

function metaMap(head) {
  const map = {};
  const tags = head.match(/<meta\s[^>]*>/gi) || [];
  tags.forEach((tag) => {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag);
    const content = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(tag);
    if (key && content) {
      const name = key[1].toLowerCase();
      if (!(name in map)) map[name] = decodeEntities(content[1] !== undefined ? content[1] : content[2]);
    }
  });
  return map;
}

function absolute(base, value) {
  if (!value) return null;
  try {
    const resolved = new URL(value, base);
    return ['http:', 'https:'].includes(resolved.protocol) ? resolved.toString() : null;
  } catch (error) {
    return null;
  }
}

function parsePreview(html, finalUrl) {
  const head = html.slice(0, MAX_BYTES);
  const meta = metaMap(head);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const title = meta['og:title'] || meta['twitter:title'] || (titleTag ? decodeEntities(titleTag[1]) : '');
  const description = meta['og:description'] || meta['twitter:description'] || meta.description || '';
  const image = absolute(finalUrl, meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src']);
  const siteName = meta['og:site_name'] || '';

  let favicon = null;
  const links = head.match(/<link\s[^>]*>/gi) || [];
  for (const tag of links) {
    const rel = /rel\s*=\s*["']([^"']+)["']/i.exec(tag);
    const href = /href\s*=\s*"([^"]*)"|href\s*=\s*'([^']*)'/i.exec(tag);
    if (rel && href && /(^|\s)(shortcut\s+icon|icon|apple-touch-icon)(\s|$)/i.test(rel[1])) {
      favicon = absolute(finalUrl, decodeEntities(href[1] !== undefined ? href[1] : href[2]));
      if (favicon) break;
    }
  }
  if (!favicon) favicon = absolute(finalUrl, '/favicon.ico');

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image,
    siteName: siteName.slice(0, 80),
    favicon
  };
}

// -> { url, host, displayHost, suspicious, reasons, title?, description?, image?, favicon?, siteName? }
export async function getLinkPreview(rawUrl) {
  const parsed = normalizeUrl(rawUrl);
  if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) return null;
  const url = parsed.toString();

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  const safety = analyzeLink(rawUrl);
  const base = { url, host: parsed.hostname, displayHost: safety.displayHost || parsed.hostname, suspicious: safety.suspicious, reasons: safety.reasons };

  let value = base;
  // Un lien suspect n'est jamais ouvert par notre serveur.
  if (!safety.suspicious) {
    try {
      const { html, finalUrl } = await fetchHtml(url);
      const preview = parsePreview(html, finalUrl);
      // Redirection vers un autre domaine : on reverifie le domaine final.
      const finalSafety = analyzeLink(finalUrl);
      if (finalSafety.suspicious) value = { ...base, suspicious: true, reasons: finalSafety.reasons };
      else value = { ...base, ...preview };
    } catch (error) {
      value = base;
    }
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(url, { at: Date.now(), value });
  return value;
}
