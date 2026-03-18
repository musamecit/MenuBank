import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://menubank.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://menubank.app/privacy', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: 'https://menubank.app/terms', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];
}
