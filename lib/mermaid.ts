export interface ParsedMermaidNode {
  id: string;
  label: string;
  type?: string;
  parent?: string;
  category?: string;
  description?: string;
  techStack?: string[];
  documentation?: string;
}

export interface ParsedMermaidEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ParsedMermaid {
  nodes: ParsedMermaidNode[];
  edges: ParsedMermaidEdge[];
  direction?: string;
}

export interface ComponentDocumentation {
  category?: string;
  techStack?: string[];
  description?: string;
  documentation?: string;
}

export function cleanLabel(raw: string): string {
  if (!raw) return "";
  let str = raw.trim();
  str = str.replace(/^["'\[]+|["'\]]+$/g, "");
  str = str.replace(/<br\s*\/?>/gi, "\n");
  return str.trim();
}

export function isValidMermaidDocument(doc: string): {
  valid: boolean;
  reason?: string;
  parsed?: ParsedMermaid;
} {
  if (!doc || !doc.trim()) {
    return { valid: false, reason: "Empty document." };
  }
  const match = doc.match(/```(?:architecture|mermaid)?\n([\s\S]*?)```/i);
  if (!match || !match[1].trim()) {
    return { valid: false, reason: "Missing or empty ```architecture block." };
  }
  try {
    const parsed = parseMermaid(doc);
    if (!parsed || !parsed.nodes || parsed.nodes.length === 0) {
      return { valid: false, reason: "No valid nodes parsed from diagram." };
    }
    return { valid: true, parsed };
  } catch (err: any) {
    return {
      valid: false,
      reason: err?.message || "Syntax error parsing diagram code.",
    };
  }
}

export function parseMermaid(mermaid: string): ParsedMermaid {
  const nodes = new Map<string, ParsedMermaidNode>();
  const edges: ParsedMermaidEdge[] = [];
  let currentSubgraph: string | undefined = undefined;
  let direction = "LR";

  let contentToParse = mermaid;
  const codeBlockMatch = mermaid.match(
    /```(?:architecture|mermaid)?\n([\s\S]*?)```/i,
  );
  if (codeBlockMatch) {
    contentToParse = codeBlockMatch[1];
  }

  // Mermaid permits a visual line break inside a node label. Keep the whole
  // declaration together before parsing it, otherwise the first half is
  // discarded and the node is later recreated from an edge at root level.
  // That was the source of empty groups and floating nodes after AI updates.
  const lines: string[] = [];
  let continuedLine = "";
  for (const rawLine of contentToParse.split("\n")) {
    const candidate = continuedLine
      ? `${continuedLine} ${rawLine.trim()}`
      : rawLine;
    const openBrackets = (candidate.match(/\[/g) || []).length;
    const closeBrackets = (candidate.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      continuedLine = candidate;
      continue;
    }
    lines.push(candidate);
    continuedLine = "";
  }
  if (continuedLine) lines.push(continuedLine);
  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith("%%") || line.startsWith("```")) continue;

    // Remove trailing semicolons if present
    line = line.replace(/;$/, "").trim();

    if (line.startsWith("flowchart ") || line.startsWith("graph ")) {
      const parts = line.split(/\s+/);
      if (parts.length > 1) {
        direction = parts[1].trim();
      }
      continue;
    }

    // Ignore Mermaid styling / class / click directives
    if (/^(classDef|class|style|linkStyle|click|direction)\s+/i.test(line)) {
      continue;
    }

    // Subgraph
    if (line.startsWith("subgraph ")) {
      const match = line.match(
        /^subgraph\s+([A-Za-z0-9_\-]+)?\s*(?:\[(.*?)\]|"(.*?)"|'(.*?)')?/i,
      );
      if (match) {
        const rawId =
          match[1] || match[2] || match[3] || match[4] || "subgraph";
        const cleanId = rawId.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        let rawLabel = match[2] || match[3] || match[4] || match[1] || rawId;
        currentSubgraph = cleanId;
        nodes.set(cleanId, {
          id: cleanId,
          label: cleanLabel(rawLabel),
          type: "group",
          category: "GROUP",
        });
      }
      continue;
    }
    if (line === "end") {
      currentSubgraph = undefined;
      continue;
    }

    // Edge matching: A <--->|label| B  OR  A -->|label| B  OR  A -- label --> B  OR  A ==> B etc.
    const edgeMatch = line.match(
      /(.+?)\s*(?:(<--->|<-->|<==>|==>|-.->|-->|---|===)\s*(?:\|(.*?)\|)?|--(.*?)\-\->|==(.*?)==>|-\.(.*?)\.-\>)\s*(.+)/,
    );
    if (edgeMatch) {
      const sourcePart = edgeMatch[1].trim();
      const edgeLabel =
        edgeMatch[3] || edgeMatch[4] || edgeMatch[5] || edgeMatch[6];
      const targetPart = edgeMatch[7].trim();

      const sourceNode = extractNode(sourcePart);
      const targetNode = extractNode(targetPart);

      if (sourceNode && targetNode) {
        if (!nodes.has(sourceNode.id)) {
          nodes.set(sourceNode.id, {
            ...enrichNode(sourceNode),
            parent: currentSubgraph,
          });
        }
        if (!nodes.has(targetNode.id)) {
          nodes.set(targetNode.id, {
            ...enrichNode(targetNode),
            parent: currentSubgraph,
          });
        }

        edges.push({
          id: `${sourceNode.id}-${targetNode.id}-${edges.length}`,
          source: sourceNode.id,
          target: targetNode.id,
          label: edgeLabel ? cleanLabel(edgeLabel) : undefined,
        });
      }
    } else {
      // Single node definition
      const node = extractNode(line);
      if (node && node.id) {
        if (!nodes.has(node.id)) {
          nodes.set(node.id, { ...enrichNode(node), parent: currentSubgraph });
        } else {
          if (node.label && node.label !== node.id) {
            const existing = nodes.get(node.id)!;
            const updated = enrichNode({ ...existing, label: node.label });
            nodes.set(node.id, updated);
          }
        }
      }
    }
  }

  // Component sections live beside the Mermaid block so they remain editable in
  // the architecture document. Merge them last: diagram syntax establishes the
  // topology, while these sections are the source of truth for rich node docs.
  const componentMetadata = parseComponentDocumentation(mermaid);
  for (const node of nodes.values()) {
    const metadata = componentMetadata.get(node.id.toLowerCase());
    if (metadata) {
      Object.assign(node, metadata);
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    direction,
  };
}

export function parseComponentDocumentation(
  document: string,
): Map<string, ComponentDocumentation> {
  const metadata = new Map<string, ComponentDocumentation>();
  const sectionPattern = /^### Component:\s*([^\r\n]+)\r?\n([\s\S]*?)(?=^### Component:|^# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW|(?![\s\S]))/gm;
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(document)) !== null) {
    const id = match[1].trim().toLowerCase();
    const body = match[2].trim();
    const categoryMatch = body.match(/^\*\*Category\*\*:\s*(.+)$/m);
    const techStackMatch = body.match(/^\*\*Tech Stack\*\*:\s*(.+)$/m);
    const summaryMatch = body.match(/^\*\*(?:Summary|Description)\*\*:\s*(.+)$/m);
    const detailMatch = body.match(/^#### Detailed Documentation\s*\r?\n([\s\S]*)$/m);

    const techStack = techStackMatch?.[1]
      .split(",")
      .map((tech) => tech.trim().replace(/^`|`$/g, ""))
      .filter(Boolean);

    // Backwards compatibility: early documents placed the free-form details
    // directly under the metadata instead of below the explicit heading.
    const legacyDocumentation = body
      .replace(/^\*\*Category\*\*:.+$/gm, "")
      .replace(/^\*\*Tech Stack\*\*:.+$/gm, "")
      .replace(/^\*\*(?:Summary|Description)\*\*:.+$/gm, "")
      .trim();

    metadata.set(id, {
      category: categoryMatch?.[1].trim(),
      techStack: techStack?.length ? techStack : undefined,
      description: summaryMatch?.[1].trim(),
      documentation: detailMatch?.[1].trim() || legacyDocumentation || undefined,
    });
  }

  return metadata;
}

function extractNode(str: string): ParsedMermaidNode | null {
  if (
    !str ||
    str.startsWith("#") ||
    str.startsWith("```") ||
    str.startsWith(">") ||
    str.startsWith("%%")
  ) {
    return null;
  }
  // Support shapes: [(Database)], [Square], (Round), {Decision}, {{Hexagon}}, >Flag]
  const match = str.match(
    /^([A-Za-z0-9_\-]+)(?:\s*(?:\[\((.*?)\)\]|\[(.*?)\]|\((.*?)\)|\{(.*?)\}|\{\{(.*?)\}\}))?$/,
  );
  if (match) {
    const id = match[1];
    const rawLabel =
      match[2] || match[3] || match[4] || match[5] || match[6] || id;
    let category: string | undefined = undefined;
    if (match[2]) category = "DATABASE";
    else if (match[4]) category = "SERVICE";
    else if (match[5]) category = "DECISION";

    return {
      id,
      label: cleanLabel(rawLabel),
      category,
    };
  }

  return null;
}

function enrichNode(node: ParsedMermaidNode): ParsedMermaidNode {
  const labelLower = node.label.toLowerCase();
  let category = node.category || "SERVICE";
  let techStack: string[] = node.techStack || [];
  let description =
    node.description || `${node.label} component in system architecture.`;
  const documentation = node.documentation;

  if (
    labelLower.includes("db") ||
    labelLower.includes("database") ||
    labelLower.includes("postgres") ||
    labelLower.includes("sql") ||
    labelLower.includes("mongo")
  ) {
    category = "DATABASE";
    if (!techStack.length) {
      if (labelLower.includes("postgres")) techStack = ["PostgreSQL", "Prisma"];
      else if (labelLower.includes("mongo"))
        techStack = ["MongoDB", "Mongoose"];
      else techStack = ["SQL", "Database"];
    }
    description =
      "Primary relational database storing application data including users, sessions, and logs.";
  } else if (
    labelLower.includes("api") ||
    labelLower.includes("backend") ||
    labelLower.includes("server") ||
    labelLower.includes("express")
  ) {
    category = "BACKEND API";
    if (!techStack.length) techStack = ["Node.js", "Express", "TypeScript"];
    description =
      "RESTful API backend handling authentication, business logic, and database operations.";
  } else if (
    labelLower.includes("app") ||
    labelLower.includes("frontend") ||
    labelLower.includes("ui") ||
    labelLower.includes("web")
  ) {
    category = "FRONTEND";
    if (!techStack.length)
      techStack = ["Next.js", "React", "TypeScript", "Tailwind"];
    description =
      "Web application serving both the customer-facing interface and admin dashboard.";
  } else if (labelLower.includes("redis") || labelLower.includes("cache")) {
    category = "CACHE";
    if (!techStack.length) techStack = ["Redis", "In-Memory"];
    description =
      "In-memory key-value cache for session tokens and fast data retrieval.";
  } else if (
    labelLower.includes("stripe") ||
    labelLower.includes("payment") ||
    labelLower.includes("billing")
  ) {
    category = "SERVICE";
    if (!techStack.length) techStack = ["Stripe API", "Webhooks"];
    description =
      "Payment processing integration for subscriptions and checkout.";
  }

  return {
    ...node,
    category,
    techStack,
    description,
    documentation,
  };
}

export function generateMermaid(nodes: any[], edges: any[]): string {
  let out = "flowchart LR\n";

  const groups = nodes.filter(
    (n) => n.type === "group" || (n.data && n.data.isGroup),
  );
  const normalNodes = nodes.filter(
    (n) => n.type !== "group" && !(n.data && n.data.isGroup),
  );

  const processedNodes = new Set<string>();

  for (const group of groups) {
    const groupLabel = group.data?.label || group.id;
    const cleanGroupId = group.id.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const cleanLabelId = groupLabel.toLowerCase().replace(/[^a-z0-9_]/g, "_");

    if (cleanGroupId === cleanLabelId || groupLabel === group.id) {
      out += `  subgraph ${groupLabel}\n`;
    } else {
      out += `  subgraph ${group.id}[${groupLabel}]\n`;
    }
    const children = normalNodes.filter((n) => n.parentId === group.id);
    for (const child of children) {
      const label = child.data?.label || child.id;
      const isDb = child.data?.category === "DATABASE";
      out += isDb
        ? `    ${child.id}[(${label})]\n`
        : `    ${child.id}[${label}]\n`;
      processedNodes.add(child.id);
    }
    out += `  end\n`;
  }

  for (const node of normalNodes) {
    if (!processedNodes.has(node.id)) {
      const label = node.data?.label || node.id;
      const isDb = node.data?.category === "DATABASE";
      out += isDb ? `  ${node.id}[(${label})]\n` : `  ${node.id}[${label}]\n`;
    }
  }

  for (const edge of edges) {
    if (edge.label) {
      out += `  ${edge.source} -->|${edge.label}| ${edge.target}\n`;
    } else {
      out += `  ${edge.source} --> ${edge.target}\n`;
    }
  }

  return out;
}
