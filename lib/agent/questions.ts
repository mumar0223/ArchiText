export interface ClarifyingQuestionOption {
  id: string;
  label: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: ClarifyingQuestionOption[];
  recommendedOptionId: string;
}

export interface ClarifyingQuestionAnswer {
  questionId: string;
  kind: "option" | "custom";
  value: string;
  optionId?: string;
}

export interface PendingQuestionFlow {
  assistantMessageId: string;
  originalPrompt: string;
  targetLabels: string[];
  questions: ClarifyingQuestion[];
  answers: Record<string, ClarifyingQuestionAnswer>;
  activeQuestionIndex: number;
}
