import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

// Dynamic language model instantiation
export function getLanguageModel(
  provider: string,
  model: string,
): LanguageModel {
  console.log(`[AI-PROVIDER] Instantiating model: ${provider} -> ${model}`);

  switch (provider) {
    case "deepseek": {
      const key = process.env.DEEPSEEK_API_KEY || "";
      const baseURL =
        process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1";
      const deepseekClient = createOpenAI({
        baseURL,
        apiKey: key,
        fetch: async (url, init) => {
          if (init && init.body) {
            try {
              const body = JSON.parse(init.body as string);
              if (Array.isArray(body.tools)) {
                const toolNames = body.tools
                  .map((t: any) => t.name || t.function?.name)
                  .join(", ");
                console.log(`[Deepseek INTERCEPTOR] Tools: ${toolNames}`);
                body.tools = body.tools.map((t: any) => {
                  const type = t.type || "function";
                  const name = t.name || t.function?.name;
                  const description = t.description || t.function?.description;
                  const parameters =
                    t.parameters || t.function?.parameters || {};

                  if (parameters) {
                    delete parameters.$schema;
                    delete parameters.additionalProperties;
                  }

                  return {
                    type,
                    function: {
                      name,
                      description,
                      parameters,
                    },
                  };
                });
                init.body = JSON.stringify(body);
              }
            } catch (e) {
              console.error("[Deepseek FETCH INTERCEPTOR ERROR]:", e);
            }
          }
          return fetch(url, init);
        },
      });
      return deepseekClient.chat(model || "deepseek-chat");
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// Unified dispatch function for executing models using Vercel AI SDK
export async function runAIModel(
  provider: string,
  model: string,
  systemInstruction: string,
  prompt: string,
): Promise<string> {
  console.log(
    `[AI-PROVIDER] Vercel AI SDK Dispatching to: ${provider} (model: ${model})`,
  );

  const modelInstance = getLanguageModel(provider, model);

  const { text } = await generateText({
    model: modelInstance,
    system: systemInstruction,
    prompt: prompt,
  });

  return text;
}
