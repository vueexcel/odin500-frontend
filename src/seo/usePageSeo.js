import { useEffect } from 'react';

function ensureMeta(attr, key, content) {
  if (typeof document === 'undefined') return;
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function ensureCanonical(url) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', url);
}

function ensureJsonLd(id, data) {
  if (typeof document === 'undefined' || !id || !data) return;
  let el = document.head.querySelector(`script[data-seo-jsonld="${id}"]`);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo-jsonld', id);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function siteOrigin() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function absoluteUrl(path) {
  const base = siteOrigin();
  const p = path && path.startsWith('/') ? path : `/${String(path || '')}`;
  return `${base}${p}`;
}

export function useSitewideSeo() {
  useEffect(() => {
    const origin = siteOrigin();
    if (!origin) return;
    ensureJsonLd('organization', {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Odin500',
      url: origin
    });
    ensureJsonLd('website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Odin500',
      url: origin
    });
  }, []);
}

/**
 * @param {{
 *  title: string,
 *  description: string,
 *  canonicalPath?: string,
 *  noindex?: boolean,
 *  ogType?: string,
 *  breadcrumbItems?: Array<{ name: string, path: string }>
 * }} options
 */
export function usePageSeo({
  title,
  description,
  canonicalPath = '/',
  noindex = false,
  ogType = 'website',
  breadcrumbItems = []
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const canonicalUrl = absoluteUrl(canonicalPath);
    document.title = title;
    ensureMeta('name', 'description', description);
    ensureMeta('name', 'robots', noindex ? 'noindex,follow' : 'index,follow');
    ensureCanonical(canonicalUrl);

    ensureMeta('property', 'og:title', title);
    ensureMeta('property', 'og:description', description);
    ensureMeta('property', 'og:type', ogType);
    ensureMeta('property', 'og:url', canonicalUrl);

    ensureMeta('name', 'twitter:card', 'summary_large_image');
    ensureMeta('name', 'twitter:title', title);
    ensureMeta('name', 'twitter:description', description);

    if (Array.isArray(breadcrumbItems) && breadcrumbItems.length) {
      ensureJsonLd('breadcrumb', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((b, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: b.name,
          item: absoluteUrl(b.path)
        }))
      });
    }
  }, [title, description, canonicalPath, noindex, ogType, breadcrumbItems]);
}

