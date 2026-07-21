export interface AgentDef {
  id: string;
  name: string;
  description: string;
}

export const AI_MODELS = {
  deepseek: [
    {
      id: process.env.NEXT_PUBLIC_DEEPSEEK_MODEL_ID,
      label: "DeepSeek v4 Flash",
      supportsImages: false,
      inputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
    },
  ],
};

export const AGENT_DEFS: AgentDef[] = [];
