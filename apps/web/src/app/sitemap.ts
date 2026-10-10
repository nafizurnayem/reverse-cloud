import type { MetadataRoute } from 'next'
import { blogPosts, portfolio, services } from '@/lib/public-content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://reverse.cloud'
  const routes = ['', '/services', '/about', '/portfolio', '/case-studies', '/blog', '/pricing', '/find-service', '/contact', ...services.map((service) => `/services/${service.slug}`), ...portfolio.map((item) => `/case-studies/${item.slug}`), ...blogPosts.map((post) => `/blog/${post.slug}`)]
  return ['en', 'bn'].flatMap((locale) => routes.map((route) => ({ url: `${baseUrl}/${locale}${route}`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: route === '' ? 1 : 0.7 })))
}
