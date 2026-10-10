'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

const questions = [
  { label: 'What are you trying to improve?', options: ['A digital product', 'An internal workflow', 'An AI capability'] },
  { label: 'How soon do you need momentum?', options: ['Exploring options', 'This quarter', 'As soon as possible'] },
  { label: 'What should happen next?', options: ['Book a conversation', 'Get an estimate', 'See relevant work'] },
]

export function ServiceFinder() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const result = useMemo(() => answers[0] ? 'A short discovery conversation is the clearest next step.' : '', [answers])
  const current = questions[step]

  function choose(value: string) {
    setAnswers((previous) => [...previous.slice(0, step), value])
  }
  function restart() {
    setStep(0)
    setAnswers([])
  }

  return <div className="rounded-2xl border border-border p-6 sm:p-8">
    {step < questions.length ? <><div className="flex items-center justify-between text-xs text-muted"><span>Step {step + 1} of {questions.length}</span><span>{Math.round(((step + 1) / questions.length) * 100)}%</span></div><div className="mt-4 h-1 rounded-full bg-border"><div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / questions.length) * 100}%` }} /></div><fieldset className="mt-8"><legend className="text-2xl font-semibold">{current.label}</legend><div className="mt-6 space-y-3">{current.options.map((option) => <label key={option} className={`block cursor-pointer rounded-lg border p-4 text-sm ${answers[step] === option ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}><input type="radio" name={`question-${step}`} value={option} checked={answers[step] === option} onChange={() => choose(option)} className="sr-only" />{option}</label>)}</div></fieldset><div className="mt-8 flex flex-wrap gap-3"><Button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)} className="bg-transparent text-foreground ring-1 ring-border hover:bg-card">Back</Button><Button type="button" disabled={!answers[step]} onClick={() => setStep((value) => value + 1)}>{step === questions.length - 1 ? 'See result' : 'Next'}</Button><Button type="button" onClick={restart} className="bg-transparent text-muted ring-1 ring-border hover:bg-card">Restart</Button></div></> : <div role="status" className="py-8"><p className="text-sm text-primary">Your next step</p><h2 className="mt-4 text-3xl font-bold">{result}</h2><p className="mt-4 text-muted">This deterministic demo result is not persisted and does not replace an approved recommendation contract.</p><Button type="button" onClick={restart} className="mt-8">Start again</Button></div>}
  </div>
}
