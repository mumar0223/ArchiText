import { generateText, hasToolCall, streamText, stepCountIs } from "ai";
import { getLanguageModel } from "../ai-provider";
import { createAgentTools } from "./tools";
import { syncProjectContextInDocument } from "../markdownExport";
import {
  buildDocumentationWriterPrompt,
  mergeDocumentationLedger,
} from "./node-documentation";
import { parseComponentDocumentation, parseMermaid } from "../mermaid";
import type { ClarifyingQuestion } from "./questions";

export interface AgentRunParams {
  messages: { role: "user" | "assistant"; content: string }[];
  document: string;
  allowQuestions?: boolean;
}

export interface AgentRunResult {
  text: string;
  updatedDocument: string;
  logs: string[];
  pendingQuestions?: ClarifyingQuestion[];
}

interface ValidationToolResult {
  toolName?: string;
  output?: { valid?: boolean };
  result?: { valid?: boolean };
}

const MAX_AGENT_STEPS = 16;
const PROJECT_CONTEXT_HEADER = "# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW";

function editableArchitectureDocument(document: string): string {
  const contextStart = document.indexOf(PROJECT_CONTEXT_HEADER);
  return (contextStart >= 0 ? document.slice(0, contextStart) : document).trim();
}

function architectureSystemPrompt(document: string, allowQuestions: boolean): string {
  return `You are ArchiText, a principal software architect and technical documentation editor. You create implementation-ready system blueprints, not generic diagrams.

Your job is to safely improve the editable architecture document below. The Mermaid graph is the source of truth for topology. The \`### Component: <node-id>\` sections are the source of truth for rich component metadata. \`PROJECT_CONTEXT.md\` is generated automatically; never manually edit or duplicate its content.

## Architecture quality bar
- Start by calling \`inspect_architecture\`. Understand the current topology, boundaries, dependencies, and documentation gaps before changing anything.
- Design at the right level of abstraction. Prefer a small set of coherent, independently understandable components over a diagram that mirrors every library or implementation detail.
- Every added component needs a clear owner, a single primary responsibility, an appropriate group, and at least one meaningful incoming or outgoing connection. Use labeled edges whenever the protocol, event, or data contract matters.
- Trace the important flows end-to-end: client/request entry, authentication or authorization where relevant, core processing, persistence, asynchronous work, and external integrations. Do not invent infrastructure or technologies unless the request justifies them; state a reasonable assumption in the node documentation when one is necessary.
- Preserve existing user-authored components and relationships unless the request explicitly replaces them. Avoid duplicate nodes and duplicate edges.

## Targeted changes and structural decisions
- A user message beginning with \`[Target Component: ...]\` or \`[Target Components: ...]\` explicitly identifies the component(s) to change. Treat it as a scoped architecture edit, not as a request to add a technology tag to an unrelated node.
- When the user says to use one system *instead of*, *replace*, *migrate from*, or *remove* another system, make the replacement visible in the Mermaid topology. Usually retain the existing node ID, group, and valid connections while changing its label, technology, category, documentation, and contracts. Rename or replace the node only when that better represents a real architectural boundary.
- For example, replacing manual authentication with Clerk changes the existing authentication component into a Clerk-backed authentication boundary; it must not merely add "Clerk" to the web frontend while silently deleting the authentication service.
- Add a new node when the requested capability is an independently deployable service, datastore, queue, provider, or boundary with its own responsibility and connections. Do not force distinct architecture responsibilities into the selected node just because it was targeted.
- Before finishing a targeted replacement, inspect the affected Mermaid lines and verify the intended component, its group membership, and its incoming/outgoing edges still exist. Update documentation for every replaced or newly added node.

## Clarifying questions
${allowQuestions ? `- Before any document mutation, call \`inspect_architecture\`. Then call \`ask_user_questions\` only if an unanswered decision would materially change the architecture: for example database/provider choice, deployment model, security/compliance constraint, scale target, integration choice, or ambiguous scope with several valid designs.
- Do not ask questions when the user already gave the answer, a low-risk default is sufficient, or the issue is an ordinary implementation detail. Never ask questions merely to prolong the interaction.
- If clarification is needed, ask every necessary question in one call (1-5 questions, each with 2-3 concrete options and one recommendation), then stop. Do not use any Mermaid/document mutation tool in the same run after asking.` : `- The latest message is an \`ask_user_questions\` tool result containing the selected answers, not a new user request. Continue the paused architecture task using those answers. Do not ask more questions; make the requested architecture changes and complete the normal validation/documentation workflow.`}

## Required working sequence
1. Inspect the architecture, then make a short internal plan. Do not reveal private chain-of-thought; use tools to show progress.
2. Make focused Mermaid edits with the diagram tools. Connect every new node immediately and keep edge direction semantically correct.
3. Call \`enrich_node_details\` for every new or materially changed non-group node. For a newly created architecture, enrich every non-group node before finishing. Never leave generic, placeholder, or empty documentation.
4. Call \`validate_documentation_completeness\`. If it reports missing components, enrich those exact nodes and validate again. Do not declare the task complete until it passes.
5. Call \`validate_mermaid_syntax\` after diagram changes. Repair any invalid result before responding.
6. Finish with a concise user-facing summary of the architecture decisions, changed components, and notable flows. The server automatically regenerates PROJECT_CONTEXT.md after your work is complete.

## Component documentation contract
For \`enrich_node_details\`, provide all fields. The \`description\` must be a precise one- or two-sentence summary (roughly 25-60 words) that a PROJECT_CONTEXT.md reader can understand without opening the component file. It should say what the component owns and how it participates in the system.

The \`documentation\` must be useful to the engineer who will implement or modify the node. Write clear Markdown with these headings when applicable:

## Responsibility & Scope
## Interfaces & Data Flow
## Data, State & Contracts
## Security, Reliability & Observability
## Implementation Guidance

Be specific to this architecture: name connected components, input/output behavior, persistence or event ownership, validation/error strategy, and practical constraints. Do not repeat the generated file location, generic status text, or vague filler. Keep each node's detail proportional to its importance—typically 8-20 useful bullets or short paragraphs, not an essay.

Current editable architecture document:
\`\`\`markdown
${editableArchitectureDocument(document)}
\`\`\``;
}

function createRuntime(
  document: string,
  messages: AgentRunParams["messages"],
  allowQuestions = true,
) {
  const provider = process.env.AI_PROVIDER || "deepseek";
  const modelId =
    process.env.DEEPSEEK_MODEL_ID ||
    process.env.NEXT_PUBLIC_DEEPSEEK_MODEL_ID ||
    "deepseek-chat";

  return {
    model: getLanguageModel(provider, modelId),
    prompt:
      messages[messages.length - 1]?.content || "Improve system architecture.",
    system: architectureSystemPrompt(document, allowQuestions),
  };
}

async function generateNodeDocumentation(
  model: ReturnType<typeof getLanguageModel>,
  document: string,
  userRequest: string,
  logs: string[],
): Promise<string> {
  const componentCount = parseMermaid(document).nodes.filter(
    (node) => node.type !== "group" && node.category !== "GROUP",
  ).length;
  if (componentCount === 0) return syncProjectContextInDocument(document);

  try {
    const firstPass = await generateText({
      model,
      prompt: buildDocumentationWriterPrompt(document, userRequest),
    });
    let merged = mergeDocumentationLedger(document, firstPass.text);
    logs.push(
      `Mapped AI documentation to ${merged.appliedNodeIds.length}/${componentCount} node IDs`,
    );

    // Retry only the missing IDs. The server, not the architecture model,
    // controls this coverage check and deterministic ID mapping.
    if (merged.missingNodeIds.length > 0) {
      const retry = await generateText({
        model,
        prompt: buildDocumentationWriterPrompt(
          merged.document,
          userRequest,
          merged.missingNodeIds,
        ),
      });
      merged = mergeDocumentationLedger(merged.document, retry.text);
      logs.push(
        `Documentation retry mapped ${merged.appliedNodeIds.length} additional node IDs`,
      );
    }

    if (merged.missingNodeIds.length > 0) {
      logs.push(
        `Documentation remains incomplete for: ${merged.missingNodeIds.join(", ")}`,
      );
    } else {
      logs.push("Completed AI-authored documentation for every architecture node");
    }
    return merged.document;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`Automatic documentation pass failed: ${message}`);
    return syncProjectContextInDocument(document);
  }
}

function buildCompletionSummary(document: string): string {
  const parsed = parseMermaid(document);
  const components = parsed.nodes.filter(
    (node) => node.type !== "group" && node.category !== "GROUP",
  );
  const groups = parsed.nodes.filter(
    (node) => node.type === "group" || node.category === "GROUP",
  );
  const documentation = parseComponentDocumentation(document);
  const documentedCount = components.filter((node) => {
    const record = documentation.get(node.id.toLowerCase());
    return Boolean(record?.description?.trim() && record.documentation?.trim());
  }).length;
  const componentNames = components.slice(0, 6).map((node) => node.label);
  const componentList = componentNames.join(", ");
  const remaining = components.length - componentNames.length;

  return [
    "Architecture update complete.",
    components.length > 0
      ? `I finalized ${components.length} components${groups.length ? ` across ${groups.length} architecture groups` : ""} and mapped ${parsed.edges.length} system connections.`
      : "I finalized the architecture document and its project context.",
    componentList
      ? `Main building blocks: ${componentList}${remaining > 0 ? `, and ${remaining} more` : ""}.`
      : "",
    `AI-authored documentation is available for ${documentedCount}/${components.length} nodes, and PROJECT_CONTEXT.md has been regenerated from the final architecture.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function streamAgentResponse({
  messages,
  document: currentDocument,
  allowQuestions = true,
}: AgentRunParams) {
  let docState = currentDocument;
  const logs: string[] = [];
  let pendingQuestions: ClarifyingQuestion[] | undefined;
  const tools = createAgentTools({
    getDocument: () => docState,
    setDocument: (updated) => {
      docState = updated;
    },
    addLog: (log) => logs.push(log),
    allowQuestionTool: allowQuestions,
    onQuestionsRequested: (questions) => {
      pendingQuestions = questions;
    },
  });
  const runtime = createRuntime(docState, messages, allowQuestions);

  const result = streamText({
    ...runtime,
    tools,
    stopWhen: allowQuestions
      ? [stepCountIs(MAX_AGENT_STEPS), hasToolCall("ask_user_questions")]
      : stepCountIs(MAX_AGENT_STEPS),
  });

  return {
    fullStream: (async function* () {
      for await (const chunk of result.fullStream) {
        yield chunk;
      }

      if (pendingQuestions) {
        yield { type: "questions-requested", questions: pendingQuestions };
        return;
      }

      // This is deterministic server finalization, intentionally outside the
      // model tool loop so a model cannot skip or hallucinate this handoff.
      docState = await generateNodeDocumentation(
        runtime.model,
        docState,
        runtime.prompt,
        logs,
      );
      logs.push("Automatically regenerated final PROJECT_CONTEXT.md");
      yield {
        type: "project-context-finalized",
        updatedDocument: docState,
      };
      yield {
        type: "completion-summary",
        text: buildCompletionSummary(docState),
      };
    })(),
  };
}

/** Runs the same complete tool workflow used by streaming requests. */
export async function runAgentLoop({
  messages,
  document: initialDocument,
  allowQuestions = true,
}: AgentRunParams): Promise<AgentRunResult> {
  let docState = initialDocument;
  const logs: string[] = [];
  let pendingQuestions: ClarifyingQuestion[] | undefined;
  const tools = createAgentTools({
    getDocument: () => docState,
    setDocument: (updated) => {
      docState = updated;
    },
    addLog: (log) => logs.push(log),
    allowQuestionTool: allowQuestions,
    onQuestionsRequested: (questions) => {
      pendingQuestions = questions;
    },
  });
  const runtime = createRuntime(docState, messages, allowQuestions);

  logs.push(`Starting architecture workflow: "${runtime.prompt.slice(0, 80)}"`);

  try {
    const result = await generateText({
      ...runtime,
      tools,
      stopWhen: allowQuestions
        ? [stepCountIs(MAX_AGENT_STEPS), hasToolCall("ask_user_questions")]
        : stepCountIs(MAX_AGENT_STEPS),
    });
    if (pendingQuestions) {
      return {
        text: "I need a few architecture decisions before making changes.",
        updatedDocument: docState,
        logs,
        pendingQuestions,
      };
    }

    const validation = ([...(result.toolResults || [])] as unknown as ValidationToolResult[])
      .reverse()
      .find((toolResult) => toolResult.toolName === "validate_mermaid_syntax");

    if (validation?.output?.valid || validation?.result?.valid) {
      logs.push("Mermaid syntax validated successfully.");
    } else {
      logs.push("Workflow completed without a recorded Mermaid validation result.");
    }

    return {
      text:
        result.text ||
        "I updated the architecture blueprint and refreshed its implementation context.",
      updatedDocument: await generateNodeDocumentation(
        runtime.model,
        docState,
        runtime.prompt,
        logs,
      ),
      logs,
    };
  } catch (error: unknown) {
    console.error("[AI-AGENT ERROR]:", error);
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`Workflow error: ${message}`);
    return {
      text: "I could not complete that architecture update. Please try again.",
      updatedDocument: syncProjectContextInDocument(docState),
      logs,
    };
  }
}
