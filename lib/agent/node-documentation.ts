import {
  parseComponentDocumentation,
  parseMermaid,
  type ComponentDocumentation,
} from "../mermaid";
import { syncProjectContextInDocument } from "../markdownExport";

const PROJECT_CONTEXT_HEADER = "# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW";

export interface DocumentationMergeResult {
  document: string;
  appliedNodeIds: string[];
  missingNodeIds: string[];
}

function editableDocument(document: string): string {
  const contextStart = document.indexOf(PROJECT_CONTEXT_HEADER);
  return (contextStart >= 0 ? document.slice(0, contextStart) : document).trim();
}

function architectureBlueprint(document: string): string {
  const match = document.match(/```(?:architecture|mermaid)\n([\s\S]*?)```/i);
  return (match?.[1] || document).trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeComponentSections(document: string): string {
  return document
    .replace(
      /^### Component:\s*[^\r\n]+\r?\n[\s\S]*?(?=^### Component:|(?![\s\S]))/gm,
      "",
    )
    .trimEnd();
}

function formatComponentSection(
  nodeId: string,
  node: ComponentDocumentation,
): string {
  return [
    `### Component: ${nodeId}`,
    "",
    `**Category**: ${node.category || "COMPONENT"}`,
    `**Tech Stack**: ${(node.techStack || []).join(", ") || "Not specified"}`,
    `**Summary**: ${node.description || "AI-authored summary pending."}`,
    "",
    "#### Detailed Documentation",
    node.documentation?.trim() || "",
  ].join("\n");
}

function isComplete(
  record: ComponentDocumentation | undefined,
): record is ComponentDocumentation {
  return Boolean(record?.description?.trim() && record.documentation?.trim());
}

export function buildDocumentationWriterPrompt(
  document: string,
  userRequest: string,
  onlyNodeIds?: string[],
): string {
  const parsed = parseMermaid(document);
  const components = parsed.nodes.filter(
    (node) =>
      node.type !== "group" &&
      node.category !== "GROUP" &&
      (!onlyNodeIds || onlyNodeIds.includes(node.id)),
  );
  const describeConnections = (nodeId: string, direction: "in" | "out") =>
    parsed.edges
      .filter((edge) => (direction === "in" ? edge.target : edge.source) === nodeId)
      .map((edge) => {
        const otherId = direction === "in" ? edge.source : edge.target;
        const other = parsed.nodes.find((node) => node.id === otherId);
        return `${other?.label || otherId} (${otherId})${edge.label ? ` via ${edge.label}` : ""}`;
      })
      .join(", ") || "None";

  const nodeInventory = components
    .map(
      (node) =>
        `- ID: ${node.id}\n  Name: ${node.label}\n  Category: ${node.category || "COMPONENT"}\n  Group: ${node.parent || "General"}\n  Inputs: ${describeConnections(node.id, "in")}\n  Outputs: ${describeConnections(node.id, "out")}`,
    )
    .join("\n");

  return `You are the documentation writer for an implementation-ready software architecture. Write authoritative, architecture-specific component specifications. Do not alter the topology and do not use JSON.

User's architecture request:
${userRequest}

Mermaid topology:
\`\`\`mermaid
${architectureBlueprint(editableDocument(document))}
\`\`\`

Component inventory and exact IDs:
${nodeInventory}

Return only a Markdown Documentation Ledger. Create exactly one section for every listed component, using its ID exactly as given. Do not use code fences, introductions, conclusions, placeholders, or generic status text.

Use this exact structure for every node:

### Component: <exact-node-id>

**Category**: <specific category>
**Tech Stack**: <comma-separated technologies or Not specified>
**Summary**: <one or two precise sentences, 25-60 words, explaining ownership and system role>

#### Detailed Documentation
## Responsibility & Scope
<specific responsibilities and non-responsibilities>

## Interfaces & Data Flow
<connected components, direction, inputs, outputs, protocols/events>

## Data, State & Contracts
<owned data, schemas/contracts, validation, consistency concerns>

## Security, Reliability & Observability
<authorization, error handling, retries, logging/metrics appropriate to this node>

## Implementation Guidance
<practical implementation boundaries and change guidance>

Every section must be specific to the supplied topology. If a detail is unknown, state a concise implementation assumption rather than inventing unrelated infrastructure.`;
}

/**
 * Maps the AI's Markdown ledger to graph node IDs. This is intentionally
 * deterministic: a section is only applied when its exact node ID exists and
 * contains both a summary and real detailed Markdown.
 */
export function mergeDocumentationLedger(
  document: string,
  ledger: string,
): DocumentationMergeResult {
  const editable = editableDocument(document);
  const parsed = parseMermaid(editable);
  const nodes = parsed.nodes.filter(
    (node) => node.type !== "group" && node.category !== "GROUP",
  );
  const existing = parseComponentDocumentation(editable);
  const generated = parseComponentDocumentation(ledger);
  const combined = new Map(existing);
  const appliedNodeIds: string[] = [];

  for (const node of nodes) {
    const generatedRecord = generated.get(node.id.toLowerCase());
    if (isComplete(generatedRecord)) {
      combined.set(node.id.toLowerCase(), generatedRecord);
      appliedNodeIds.push(node.id);
    }
  }

  const missingNodeIds = nodes
    .filter((node) => !isComplete(combined.get(node.id.toLowerCase())))
    .map((node) => node.id);
  const baseDocument = removeComponentSections(editable);
  // Build sections in node order; filtering above must not shift an ID onto a
  // different record when an older diagram is missing documentation.
  const orderedSections = nodes.flatMap((node) => {
    const record = combined.get(node.id.toLowerCase());
    return isComplete(record) ? [formatComponentSection(node.id, record)] : [];
  });
  const mergedDocument = [baseDocument, ...orderedSections].filter(Boolean).join("\n\n");

  return {
    document: syncProjectContextInDocument(mergedDocument),
    appliedNodeIds,
    missingNodeIds,
  };
}
