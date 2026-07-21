import { tool } from "ai";
import { z } from "zod";
import { parseMermaid } from "../mermaid";
import { syncProjectContextInDocument } from "../markdownExport";
import type { ClarifyingQuestion } from "./questions";

export interface AgentStateAccessor {
  getDocument: () => string;
  setDocument: (doc: string) => void;
  addLog: (log: string) => void;
  onQuestionsRequested?: (questions: ClarifyingQuestion[]) => void;
  allowQuestionTool?: boolean;
}

export function createAgentTools({
  getDocument,
  setDocument,
  addLog,
  onQuestionsRequested,
  allowQuestionTool = true,
}: AgentStateAccessor) {
  const updateAndSyncDoc = (doc: string) => {
    const synced = syncProjectContextInDocument(doc);
    setDocument(synced);
    return synced;
  };
  const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hasStoredDocumentation = (document: string, nodeId: string) =>
    new RegExp(
      `^### Component:\\s*${escapeRegex(nodeId)}\\s*\\r?\\n[\\s\\S]*?^#### Detailed Documentation\\s*\\r?\\n\\s*\\S`,
      "mi",
    ).test(document);
  const documentationGaps = (document: string) =>
    parseMermaid(document).nodes
      .filter((node) => node.type !== "group" && node.category !== "GROUP")
      .filter((node) => !hasStoredDocumentation(document, node.id))
      .map((node) => ({ id: node.id, label: node.label }));

  const askUserQuestions = tool({
    description:
      "Ask the user a single batch of important architecture clarification questions before making any document changes. Use only when missing information could materially change the architecture. Each question needs 2-3 concrete options and exactly one recommended option.",
    inputSchema: z
      .object({
        questions: z
          .array(
            z
              .object({
                id: z.string().min(1).max(80),
                question: z.string().min(8).max(280),
                options: z
                  .array(
                    z.object({
                      id: z.string().min(1).max(80),
                      label: z.string().min(1).max(180),
                    }),
                  )
                  .min(2)
                  .max(3),
                recommendedOptionId: z.string().min(1).max(80),
              })
              .superRefine((question, context) => {
                const optionIds = question.options.map((option) => option.id);
                if (new Set(optionIds).size !== optionIds.length) {
                  context.addIssue({ code: "custom", message: "Question option IDs must be unique." });
                }
                if (!optionIds.includes(question.recommendedOptionId)) {
                  context.addIssue({ code: "custom", message: "recommendedOptionId must refer to one option." });
                }
              }),
          )
          .min(1)
          .max(5),
      })
      .superRefine((input, context) => {
        const ids = input.questions.map((question) => question.id);
        if (new Set(ids).size !== ids.length) {
          context.addIssue({ code: "custom", message: "Question IDs must be unique." });
        }
      }),
    execute: async ({ questions }) => {
      onQuestionsRequested?.(questions);
      addLog(`Waiting for user response to ${questions.length} architecture question${questions.length === 1 ? "" : "s"}`);
      return { awaitingUserAnswers: true, questions };
    },
  });

  return {
    ...(allowQuestionTool ? { ask_user_questions: askUserQuestions } : {}),
    inspect_architecture: tool({
      description:
        "Inspect the architecture as structured data before planning edits. Returns nodes, dependencies, and documentation coverage without modifying the document.",
      inputSchema: z.object({}),
      execute: async () => {
        const parsed = parseMermaid(getDocument());
        const components = parsed.nodes
          .filter((node) => node.type !== "group" && node.category !== "GROUP")
          .map((node) => ({
            id: node.id,
            label: node.label,
            category: node.category,
            parentGroup: node.parent,
            incoming: parsed.edges
              .filter((edge) => edge.target === node.id)
              .map((edge) => edge.source),
            outgoing: parsed.edges
              .filter((edge) => edge.source === node.id)
              .map((edge) => edge.target),
            hasDetailedDocumentation: hasStoredDocumentation(getDocument(), node.id),
            hasSummary: Boolean(node.description),
            techStack: node.techStack || [],
          }));
        const undocumented = components
          .filter((component) => !component.hasDetailedDocumentation)
          .map((component) => component.id);
        addLog(`Inspected architecture: ${components.length} components, ${parsed.edges.length} connections`);
        return {
          direction: parsed.direction,
          groups: parsed.nodes
            .filter((node) => node.type === "group" || node.category === "GROUP")
            .map((node) => ({ id: node.id, label: node.label })),
          components,
          connections: parsed.edges,
          documentationGaps: undocumented,
        };
      },
    }),

    validate_documentation_completeness: tool({
      description:
        "Verify that every non-group Mermaid node has an explicit AI-authored Component section with non-empty detailed Markdown. Call this before declaring an architecture complete.",
      inputSchema: z.object({}),
      execute: async () => {
        const missingComponents = documentationGaps(getDocument());
        const valid = missingComponents.length === 0;
        addLog(
          valid
            ? "Validated documentation coverage for all components"
            : `Documentation missing for: ${missingComponents.map((node) => node.id).join(", ")}`,
        );
        return { valid, missingComponents };
      },
    }),

    read_markdown_lines: tool({
      description:
        "Read specific line range [startLine, endLine] from the architecture document.",
      inputSchema: z.object({
        startLine: z.number().describe("1-based start line number"),
        endLine: z.number().describe("1-based end line number"),
      }),
      execute: async ({ startLine, endLine }) => {
        const docState = getDocument();
        const lines = docState.split("\n");
        const sliced = lines.slice(Math.max(0, startLine - 1), endLine);
        addLog(`Read lines ${startLine} to ${endLine}`);
        return {
          lines: sliced.map((line, idx) => `${startLine + idx}: ${line}`),
          totalLines: lines.length,
        };
      },
    }),

    replace_markdown_lines: tool({
      description:
        "Replace a specific line range [startLine, endLine] in the document with new lines of text without full document regeneration.",
      inputSchema: z.object({
        startLine: z.number().describe("1-based start line number"),
        endLine: z.number().describe("1-based end line number"),
        replacementText: z
          .string()
          .describe("New text lines to insert into the specified line range"),
      }),
      execute: async ({ startLine, endLine, replacementText }) => {
        const docState = getDocument();
        const lines = docState.split("\n");
        const newLines = replacementText.split("\n");
        lines.splice(
          Math.max(0, startLine - 1),
          endLine - startLine + 1,
          ...newLines,
        );
        const updated = lines.join("\n");
        const synced = updateAndSyncDoc(updated);
        addLog(`Replaced lines ${startLine}-${endLine}`);
        return { success: true, newTotalLines: lines.length, updatedDocument: synced };
      },
    }),

    add_node_to_diagram: tool({
      description:
        "Add a new node or database component to the Mermaid architecture diagram.",
      inputSchema: z.object({
        nodeId: z
          .string()
          .describe(
            "Unique identifier for the node (e.g. redis_cache, auth_api)",
          ),
        label: z
          .string()
          .describe("Human readable component label (e.g. Redis Cache)"),
        isDatabase: z
          .boolean()
          .optional()
          .describe("True if node represents a database shape [()]"),
        subgraphName: z
          .string()
          .optional()
          .describe(
            "Optional subgraph name to insert node into (e.g. Backend)",
          ),
      }),
      execute: async ({ nodeId, label, isDatabase, subgraphName }) => {
        let docState = getDocument();
        const cleanId = nodeId.toLowerCase().replace(/[^a-z0-9_]/g, "");
        const syntax = isDatabase
          ? `${cleanId}[(${label})]`
          : `${cleanId}[${label}]`;

        if (docState.includes("```architecture")) {
          const subgraphRegex = new RegExp(
            `(subgraph\\s+${subgraphName}[\\s\\S]*?)(\\n\\s*end\\b)`,
            "i",
          );
          if (subgraphName && subgraphRegex.test(docState)) {
            docState = docState.replace(
              subgraphRegex,
              `$1\n    ${syntax}$2`,
            );
          } else {
            docState = docState.replace(
              /```architecture\n([\s\S]*?)```/,
              (match, p1) => `\`\`\`architecture\n${p1.trim()}\n  ${syntax}\n\`\`\``,
            );
          }
        } else {
          docState += `\n\n\`\`\`architecture\nflowchart LR\n  ${syntax}\n\`\`\``;
        }
        const synced = updateAndSyncDoc(docState);
        addLog(`Added node '${label}' (${cleanId}) to diagram`);
        return { success: true, nodeId: cleanId, updatedDocument: synced };
      },
    }),

    connect_nodes_in_diagram: tool({
      description:
        "Create a directed connection arrow between source and target nodes in the diagram.",
      inputSchema: z.object({
        sourceId: z.string().describe("Source node ID"),
        targetId: z.string().describe("Target node ID"),
        label: z
          .string()
          .optional()
          .describe("Optional edge label (e.g. HTTPS, gRPC)"),
      }),
      execute: async ({ sourceId, targetId, label }) => {
        let docState = getDocument();
        const edgeStr = label
          ? `  ${sourceId} -->|${label}| ${targetId}`
          : `  ${sourceId} --> ${targetId}`;
        if (docState.includes("```architecture")) {
          docState = docState.replace(
            /```architecture\n([\s\S]*?)```/,
            (match, p1) =>
              `\`\`\`architecture\n${p1.trim()}\n${edgeStr}\n\`\`\``,
          );
        }
        const synced = updateAndSyncDoc(docState);
        addLog(`Connected ${sourceId} --> ${targetId}`);
        return { success: true, updatedDocument: synced };
      },
    }),

    validate_mermaid_syntax: tool({
      description:
        "Parse and validate the current Mermaid diagram block in the document to ensure no syntax errors exist.",
      inputSchema: z.object({}),
      execute: async () => {
        const docState = getDocument();
        const match = docState.match(/```architecture\n([\s\S]*?)```/);
        if (!match) {
          return {
            valid: false,
            error: "No ```architecture block found in document.",
            updatedDocument: docState,
          };
        }
        try {
          const parsed = parseMermaid(match[1]);
          addLog(
            `Validated diagram: ${parsed.nodes.length} nodes, ${parsed.edges.length} edges`,
          );
          return {
            valid: true,
            nodesCount: parsed.nodes.length,
            edgesCount: parsed.edges.length,
            updatedDocument: docState,
          };
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          addLog(`Validation failed: ${message}`);
          return { valid: false, error: message, updatedDocument: docState };
        }
      },
    }),

    enrich_node_details: tool({
      description:
        "Create or replace the reusable metadata and implementation-ready Markdown for one existing non-group diagram node. This content is parsed into the node view and component export files.",
      inputSchema: z.object({
        nodeId: z.string().describe("Target node ID"),
        category: z
          .string()
          .optional()
          .describe(
            "Category badge (DATABASE, FRONTEND, BACKEND API, CACHE)",
          ),
        techStack: z
          .array(z.string())
          .optional()
          .describe("Array of technologies (e.g. ['Next.js', 'React'])"),
        description: z
          .string()
          .optional()
          .describe("One- or two-sentence project-context summary of responsibility and system role"),
        documentation: z
          .string()
          .optional()
          .describe("Specific implementation Markdown covering scope, interfaces, data/contracts, operations, and change guidance"),
      }),
      execute: async ({
        nodeId,
        category,
        techStack,
        description,
        documentation,
      }) => {
        let docState = getDocument();
        const cleanId = nodeId.toLowerCase().replace(/[^a-z0-9_-]/g, "");
        const currentNode = parseMermaid(docState).nodes.find(
          (node) => node.id.toLowerCase() === cleanId,
        );

        if (!currentNode || currentNode.type === "group" || currentNode.category === "GROUP") {
          addLog(`Could not enrich unknown component '${nodeId}'`);
          return {
            success: false,
            error: `Component '${nodeId}' does not exist in the Mermaid diagram.`,
            updatedDocument: docState,
          };
        }

        const resolvedCategory = category || currentNode.category || "COMPONENT";
        const resolvedTechStack = techStack || currentNode.techStack || [];
        const resolvedDescription = description || currentNode.description ||
          `${currentNode.label} component in the system architecture.`;
        const resolvedDocumentation = documentation || currentNode.documentation ||
          "Document the component's implementation boundaries, contracts, operational concerns, and change guidance here.";

        const sectionPattern = new RegExp(
          `^### Component:\\s*${escapeRegex(cleanId)}\\s*\\r?\\n[\\s\\S]*?(?=^### Component:|^# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW|(?![\\s\\S]))`,
          "gmi",
        );
        docState = docState.replace(sectionPattern, "").trimEnd();

        const projectContextIndex = docState.indexOf("# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW");
        if (projectContextIndex >= 0) {
          docState = docState.slice(0, projectContextIndex).trimEnd();
        }

        const sectionText = [
          `### Component: ${cleanId}`,
          "",
          `**Category**: ${resolvedCategory}`,
          `**Tech Stack**: ${resolvedTechStack.join(", ") || "Not yet selected"}`,
          `**Summary**: ${resolvedDescription}`,
          "",
          "#### Detailed Documentation",
          resolvedDocumentation.trim(),
        ].join("\n");
        docState = `${docState}\n\n${sectionText}\n`;
        const synced = updateAndSyncDoc(docState);
        addLog(`Enriched reusable documentation for node '${cleanId}'`);
        return {
          success: true,
          nodeId: cleanId,
          applied: {
            category: resolvedCategory,
            techStack: resolvedTechStack,
            description: resolvedDescription,
            documentation: resolvedDocumentation,
          },
          updatedDocument: synced,
        };
      },
    }),
  };
}
