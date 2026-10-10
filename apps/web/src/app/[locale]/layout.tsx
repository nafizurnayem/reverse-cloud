import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ThemeProvider } from 'next-themes'
import { inter, notoSansBengali } from '@/lib/fonts'
import { routing } from '@/i18n/routing'
import '../globals.css'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'bn' ? 'রিভার্স ক্লাউড — পরবর্তী কাজ তৈরি করুন' : 'Reverse Cloud — Build what comes next',
    description: locale === 'bn' ? 'পরবর্তী সুবিধার পেছনের সিস্টেম তৈরি করি।' : 'Engineering the systems behind your next advantage.',
    alternates: {
      canonical: `https://reverse.cloud/${locale}`,
      languages: { en: 'https://reverse.cloud/en', bn: 'https://reverse.cloud/bn' },
    },
  }
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params
  if (!routing.locales.includes(locale as 'en' | 'bn')) notFound()
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${notoSansBengali.variable}`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>{children}</NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
