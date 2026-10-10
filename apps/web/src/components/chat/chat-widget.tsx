'use client'

import { Bot, MessageCircle, Send, UserRound, X } from 'lucide-react'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { ChatCardRenderer } from './chat-cards'
import { parseCard, parseChatEvent, type ChatCard } from './chat-contract'

type Message = { role: 'assistant' | 'user'; text: string; card?: ChatCard }

export function ChatWidget() {
  const t = useTranslations('chat')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', text: t('welcome') }])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setError(null)
    setMessages((current) => [...current, { role: 'user', text }, { role: 'assistant', text: '' }])
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 30000)
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/event-stream, application/json' }, body: JSON.stringify({ message: text, locale }), signal: controller.signal })
      window.clearTimeout(timeout)
      if (response.status === 429) throw new Error('rate_limit')
      if (response.status === 501 || !response.ok) throw new Error('unavailable')
      if (!response.body) throw new Error('unavailable')
      await consumeResponse(response)
    } catch (cause) {
      const key = cause instanceof DOMException && cause.name === 'AbortError' ? 'timeout' : cause instanceof Error && cause.message === 'rate_limit' ? 'rateLimit' : 'unavailable'
      setMessages((current) => current.slice(0, -1))
      setError(t(key))
    } finally {
      setLoading(false)
    }
  }

  async function consumeResponse(response: Response) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = await response.json() as { message?: unknown; card?: unknown }
      if (typeof payload.message === 'string') appendAssistantText(payload.message)
      if (payload.card) appendCard(parseCard(payload.card))
      return
    }
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const event = parseChatEvent(JSON.parse(line.slice(5).trim()))
        if (!event) continue
        if (event.type === 'text_delta' || event.type === 'message') appendAssistantText(event.text)
        if (event.type === 'card') appendCard(parseCard(event.card))
        if (event.type === 'error') throw new Error('unavailable')
      }
      if (done) break
    }
  }

  function appendAssistantText(text: string) {
    setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, text: message.text + text } : message))
  }
  function appendCard(card: ChatCard | null) {
    if (card) setMessages((current) => current.map((message, index) => index === current.length - 1 ? { ...message, card } : message))
    else setError(t('unknownCard'))
  }

  return <><button type="button" onClick={() => setOpen(true)} aria-label={t('open')} className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105"><MessageCircle size={23} /></button>{open && <section role="dialog" aria-modal="true" aria-labelledby="chat-title" className="fixed inset-x-3 bottom-3 z-50 flex h-[min(720px,calc(100vh-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(720px,calc(100vh-3rem))] sm:w-[min(420px,calc(100vw-3rem))]"><header className="flex items-center justify-between border-b border-border bg-foreground px-5 py-4 text-background"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bot size={18} /></span><div><h2 id="chat-title" className="text-sm font-semibold">{t('title')}</h2><p className="text-xs text-background/60">{t('subtitle')}</p></div></div><button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="rounded-sm"><X size={19} /></button></header><div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] break-words rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'}`}>{message.role === 'assistant' && <Bot size={14} className="mb-1 text-primary" />}{message.text && <p className="whitespace-pre-wrap">{message.text}</p>}{message.card && <ChatCardRenderer card={message.card} onStatus={setError} />}</div>{message.role === 'user' && <UserRound size={15} className="mt-3 text-primary" />}</div>)}{loading && <div className="flex items-center gap-2 text-sm text-muted"><Bot size={15} className="text-primary" />{t('thinking')}</div>}{error && <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700">{error}<button type="button" onClick={() => setError(null)} className="ml-2 font-semibold underline">{t('dismiss')}</button></div>}</div><form onSubmit={submit} className="flex gap-2 border-t border-border p-3"><Input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} placeholder={t('placeholder')} aria-label={t('inputLabel')} disabled={loading} /><button type="submit" disabled={loading || !input.trim()} aria-label={t('send')} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Send size={17} /></button></form></section>}</>
}
