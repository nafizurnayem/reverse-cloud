"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateTopServices,
  TopServiceResult,
  WizardQuestion,
} from "@/lib/wizard-engine";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";


interface WizardContainerProps {
  questions: WizardQuestion[];
  locale: string;
  labels: {
    stepLabel: string;
    multiHint: string;
    next: string;
    back: string;
    calculate: string;
    restart: string;
    resultsTitle: string;
    resultsSubtitle: string;
    matchLabel: string;
    startingFrom: string;
    customQuote: string;
    viewService: string;
    requestService: string;
    ctaTitle: string;
    ctaSubtitle: string;
    contactUs: string;
  };
}

export function WizardContainer({ questions, locale, labels }: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<TopServiceResult[] | null>(null);

  const currentQ = questions[currentStep];
  const totalSteps = questions.length;
  const isLastStep = currentStep === totalSteps - 1;

  const currentSelected = (currentQ ? answers[currentQ.key] : []) || [];
  const hasSelection = currentSelected.length > 0;

  const handleSelect = (optionId: string) => {
    if (!currentQ) return;

    if (currentQ.kind === "single") {
      setAnswers((prev) => ({
        ...prev,
        [currentQ.key]: [optionId],
      }));
    } else {
      // multi-select
      setAnswers((prev) => {
        const existing = prev[currentQ.key] || [];
        const updated = existing.includes(optionId)
          ? existing.filter((id) => id !== optionId)
          : [...existing, optionId];
        return {
          ...prev,
          [currentQ.key]: updated,
        };
      });
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      const topServices = calculateTopServices(answers, questions);
      setResults(topServices);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setResults(null);
    setCurrentStep(0);
  };

  // -------------------------------- RESULTS VIEW --------------------------------
  if (results) {
    return (
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-3">
          <Badge className="bg-primary text-primary-foreground font-semibold">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            {labels.resultsTitle}
          </Badge>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {labels.resultsTitle}
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            {labels.resultsSubtitle}
          </p>
        </div>

        {/* Top 3 Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {results.map((res, index) => {
            const service = res.service;
            const name = locale === "bn" ? service.name_bn : service.name_en;
            const summary = locale === "bn" ? service.summary_bn : service.summary_en;
            const price = service.starting_from_usd
              ? `$${service.starting_from_usd.toLocaleString()} USD`
              : labels.customQuote;

            const isTopRank = index === 0;

            return (
              <Card
                key={service.slug}
                className={`relative flex flex-col transition-all ${
                  isTopRank
                    ? "border-primary bg-card shadow-md ring-2 ring-primary/20"
                    : "border-border/70 bg-card hover:border-primary/40"
                }`}
              >
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      #{index + 1}
                    </span>
                    <Badge variant={isTopRank ? "default" : "secondary"} className="text-xs font-semibold">
                      {res.matchPercentage}% Match
                    </Badge>
                  </div>

                  <CardTitle className="text-lg font-bold">{name}</CardTitle>
                  <CardDescription className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {summary}
                  </CardDescription>
                </CardHeader>

                <CardContent className="mt-auto space-y-4 pt-2">
                  <div className="flex items-baseline justify-between border-t border-border/60 pt-3 text-xs">
                    <span className="text-muted-foreground">{labels.startingFrom}:</span>
                    <span className="font-extrabold text-foreground">{price}</span>
                  </div>

                  <div className="space-y-2">
                    <Link
                      href={`/services/${service.slug}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background py-2 text-xs font-semibold text-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                    >
                      <span>{labels.viewService}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/contact?service=${service.slug}`}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
                    >
                      <span>{labels.requestService}</span>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            <span>{labels.restart}</span>
          </button>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90"
          >
            <span>{labels.contactUs}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------- QUESTIONNAIRE STEP VIEW --------------------------------
  if (!currentQ) return null;

  const stepPct = Math.round(((currentStep + 1) / totalSteps) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Progress Bar & Counter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>
            {labels.stepLabel
              .replace("{current}", String(currentStep + 1))
              .replace("{total}", String(totalSteps))}
          </span>
          <span>{stepPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${stepPct}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:p-10">
        <div className="space-y-2">
          {currentQ.kind === "multi" && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {labels.multiHint}
            </Badge>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {locale === "bn" ? currentQ.text_bn : currentQ.text_en}
          </h2>
        </div>

        {/* Options Grid */}
        <div className="mt-8 space-y-3">
          {currentQ.options.map((opt) => {
            const isSelected = currentSelected.includes(opt.id);
            const label = locale === "bn" ? opt.label_bn : opt.label_en;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.id)}
                className={`group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 text-primary shadow-subtle ring-1 ring-primary"
                    : "border-border/70 bg-card/60 text-foreground hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <div
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 bg-background group-hover:border-primary/50"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>

                <span className="text-sm font-medium leading-relaxed sm:text-base">
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Step Navigation Controls */}
        <div className="mt-10 flex items-center justify-between border-t border-border/60 pt-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors ${
              currentStep === 0
                ? "cursor-not-allowed opacity-40"
                : "hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{labels.back}</span>
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!hasSelection}
            className={`inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all ${
              !hasSelection
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-primary/90"
            }`}
          >
            <span>{isLastStep ? labels.calculate : labels.next}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
