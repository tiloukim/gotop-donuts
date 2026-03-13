import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/cart', '/checkout', '/account', '/orders'],
    },
    sitemap: 'https://www.gotopdonuts.com/sitemap.xml',
  };
}
