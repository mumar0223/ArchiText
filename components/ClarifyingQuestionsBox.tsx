"use client";

import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Send, SkipForward, Sparkles } from "lucide-react";
import type {
  ClarifyingQuestionAnswer,
  PendingQuestionFlow,
} from "@/lib/agent/questions";

interface ClarifyingQuestionsBoxProps {
  flow: PendingQuestionFlow;
  onChange: (flow: PendingQuestionFlow) => void;
  onSubmit: () => void;
  isLoading?: boolean;
}

export default function ClarifyingQuestionsBox({
  flow,
  onChange,
  onSubmit,
  isLoading,
}: ClarifyingQuestionsBoxProps) {
  const activeIndex = Math.min(
    Math.max(flow.activeQuestionIndex, 0),
    flow.questions.length - 1,
  );
  const question = flow.questions[activeIndex];
  const currentAnswer = flow.answers[question.id];
  const [customAnswer, setCustomAnswer] = useState(
    currentAnswer?.kind === "custom" ? currentAnswer.value : "",
  );

  useEffect(() => {
    setCustomAnswer(
      flow.answers[question.id]?.kind === "custom"
        ? flow.answers[question.id].value
        : "",
    );
  }, [flow.answers, question.id]);

  const updateAnswer = (answer: ClarifyingQuestionAnswer) => {
    onChange({
      ...flow,
      answers: { ...flow.answers, [question.id]: answer },
      activeQuestionIndex:
        activeIndex < flow.questions.length - 1 ? activeIndex + 1 : activeIndex,
    });
  };

  const selectOption = (optionId: string, label: string) => {
    updateAnswer({ questionId: question.id, kind: "option", optionId, value: label });
  };

  const confirmCustomAnswer = () => {
    const value = customAnswer.trim();
    if (!value) return;
    updateAnswer({ questionId: question.id, kind: "custom", value });
  };

  const goToQuestion = (index: number) => {
    onChange({ ...flow, activeQuestionIndex: index });
  };

  const useRecommendations = () => {
    const answers = { ...flow.answers };
    flow.questions.forEach((item) => {
      if (answers[item.id]) return;
      const recommended = item.options.find(
        (option) => option.id === item.recommendedOptionId,
      );
      if (recommended) {
        answers[item.id] = {
          questionId: item.id,
          kind: "option",
          optionId: recommended.id,
          value: recommended.label,
        };
      }
    });
    onChange({ ...flow, answers });
  };

  const isComplete = flow.questions.every((item) => Boolean(flow.answers[item.id]));

  return (
    <div className="absolute bottom-4 left-1/2 z-30 w-[600px] max-w-[92vw] -translate-x-1/2 border border-border bg-card p-4 shadow-[4px_4px_0px_0px_var(--shadow-color)] transition-colors">
      {flow.targetLabels.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {flow.targetLabels.map((label) => (
            <span key={label} className="inline-flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground text-[10px] font-bold font-mono">
              <Sparkles size={11} className="text-orange-400" /> Target: {label}
            </span>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <span className="font-serif text-sm font-bold text-foreground">{question.question}</span>
        <span className="shrink-0 text-[10px] font-mono text-muted-foreground">Question {activeIndex + 1} of {flow.questions.length}</span>
      </div>

      <div className="space-y-1.5">
        {question.options.map((option, index) => {
          const selected = currentAnswer?.kind === "option" && currentAnswer.optionId === option.id;
          const recommended = option.id === question.recommendedOptionId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => selectOption(option.id, option.label)}
              className={`w-full border px-3 py-2 text-left text-xs transition-colors flex items-center gap-3 ${
                selected ? "border-primary bg-primary/15 text-foreground" : "border-border-subtle hover:bg-muted text-foreground"
              }`}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center bg-muted font-mono text-[10px] font-bold">{index + 1}</span>
              <span className="flex-1">{option.label}</span>
              {recommended && <span className="text-[9px] font-mono uppercase tracking-wide text-orange-400">Recommended</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 border border-border-subtle bg-muted/40 px-2 py-1.5">
        <input
          value={customAnswer}
          onChange={(event) => setCustomAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirmCustomAnswer();
            }
          }}
          placeholder="Something else..."
          className="min-w-0 flex-1 bg-transparent px-1 text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={confirmCustomAnswer}
          disabled={!customAnswer.trim()}
          title="Use custom answer"
          className="inline-flex h-7 w-7 items-center justify-center bg-primary text-primary-foreground disabled:opacity-40"
        >
          <Check size={14} />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => goToQuestion(activeIndex - 1)} disabled={activeIndex === 0} className="inline-flex items-center gap-1 border border-border px-2.5 py-1.5 text-[10px] font-mono disabled:opacity-35 hover:bg-muted">
            <ChevronLeft size={13} /> Back
          </button>
          <button type="button" onClick={() => goToQuestion(activeIndex + 1)} disabled={activeIndex === flow.questions.length - 1 || !currentAnswer} className="inline-flex items-center gap-1 border border-border px-2.5 py-1.5 text-[10px] font-mono disabled:opacity-35 hover:bg-muted">
            Next <ChevronRight size={13} />
          </button>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={useRecommendations} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground">
            <SkipForward size={13} /> Skip: use recommendations
          </button>
          <button type="button" onClick={onSubmit} disabled={!isComplete || isLoading} className="inline-flex items-center gap-1 bg-primary px-3 py-1.5 text-[10px] font-bold font-mono text-primary-foreground disabled:opacity-40">
            <Send size={13} /> Submit
          </button>
        </div>
      </div>
    </div>
  );
}
