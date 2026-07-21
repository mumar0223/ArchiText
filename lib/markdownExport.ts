import JSZip from "jszip";
import { parseMermaid, ParsedMermaidNode, ParsedMermaidEdge } from "./mermaid";

export interface ExportFileItem {
  path: string; // Relative path, e.g. "Frontend/App.md" or "PROJECT_CONTEXT.md"
  folder: string; // Folder name, e.g. "Frontend" or "" for root
  filename: string; // Filename, e.g. "App.md"
  title: string; // Human-readable label
  content: string; // Full markdown text content
  isIndex?: boolean; // True if this is the main overview file
  componentId?: string; // Present for a node-specific component specification
}

function sanitizeName(name: string): string {
  return name.trim().replace(/[/\\?%*:|"<>]/g, "_");
}

function withoutProjectContext(document: string): string {
  const marker = "# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW";
  const contextStart = document.indexOf(marker);
  return (contextStart >= 0 ? document.slice(0, contextStart) : document).trim();
}

function architectureBlueprint(document: string): string {
  const match = document.match(/```(?:architecture|mermaid)\n([\s\S]*?)```/i);
  return (match?.[1] || document).trim();
}

function contextSummary(value: string | undefined): string {
  const plainText = (value || "No concise responsibility summary has been recorded.")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plainText.length > 280 ? `${plainText.slice(0, 277).trimEnd()}...` : plainText;
}

function markdownFileLink(path: string, label: string): string {
  // Raw spaces make generated Markdown links display as literal text in many
  // renderers. Encoded relative paths remain valid in exports and previews.
  return `[${label}](./${encodeURI(path)})`;
}

function withoutTrailingDivider(documentation: string): string {
  // Some earlier AI-authored details ended with their own Markdown divider.
  // Component exports add one canonical footer divider, so remove the legacy
  // version to prevent the double-rule shown in every component file.
  return documentation.replace(/\n\s*---\s*$/, "").trimEnd();
}

export function buildExportFileTree(mermaidDocument: string): ExportFileItem[] {
  const editableDocument = withoutProjectContext(mermaidDocument);
  const parsed = parseMermaid(editableDocument);
  const { nodes, edges } = parsed;

  const groups = nodes.filter(
    (n) => n.type === "group" || n.category === "GROUP",
  );
  const regularNodes = nodes.filter(
    (n) => n.type !== "group" && n.category !== "GROUP",
  );

  // Group lookup map: id -> group label
  const groupMap = new Map<string, string>();
  groups.forEach((g) => {
    groupMap.set(g.id, g.label || g.id);
  });

  const files: ExportFileItem[] = [];

  // 1. Generate Detailed Markdown for each architecture node
  regularNodes.forEach((node) => {
    const parentId = node.parent;
    const folderName = parentId
      ? sanitizeName(groupMap.get(parentId) || parentId)
      : "General";

    const cleanLabel = sanitizeName(node.label || node.id);
    const filename = `${cleanLabel}.md`;
    const relativePath = `${folderName}/${filename}`;

    // Find incoming & outgoing edges
    const incoming = edges.filter((e) => e.target === node.id);
    const outgoing = edges.filter((e) => e.source === node.id);

    const getNodeLabel = (id: string) => {
      const found = nodes.find((n) => n.id === id);
      return found ? `${found.label} (\`${found.id}\`)` : `\`${id}\``;
    };

    // Every node markdown starts with Detailed Info & File Location
    let md = `# Component Specification: ${node.label}\n\n`;
    md += `> **File Location**: \`./${relativePath}\`  \n`;
    md += `> **Component ID**: \`${node.id}\` | **Category**: \`${node.category || "COMPONENT"}\` | **Parent Group**: \`${folderName}/\`\n\n`;

    md += `## 1. Detailed Overview & Purpose\n`;
    md += `${node.description || "No specific overview description provided for this component."}\n\n`;

    md += `## 2. Tech Stack & Software Specifications\n`;
    if (node.techStack && node.techStack.length > 0) {
      node.techStack.forEach((tech) => {
        md += `- **${tech}**\n`;
      });
    } else {
      md += `*No specific tech stack specified.*\n`;
    }
    md += `\n`;

    md += `## 3. Architecture Connectivity & Dependencies\n`;
    md += `### Incoming Connections (Source Inputs)\n`;
    if (incoming.length > 0) {
      incoming.forEach((inc) => {
        const edgeInfo = inc.label ? ` via *${inc.label}*` : "";
        md += `- From: ${getNodeLabel(inc.source)}${edgeInfo}\n`;
      });
    } else {
      md += `*None (Entry point or standalone component)*\n`;
    }
    md += `\n`;

    md += `### Outgoing Connections (Target Outputs)\n`;
    if (outgoing.length > 0) {
      outgoing.forEach((out) => {
        const edgeInfo = out.label ? ` via *${out.label}*` : "";
        md += `- To: ${getNodeLabel(out.target)}${edgeInfo}\n`;
      });
    } else {
      md += `*None (Terminal component or data sink)*\n`;
    }
    md += `\n`;

    md += `## 4. Full Technical Documentation\n`;
    const technicalDocumentation = node.documentation
      ? withoutTrailingDivider(node.documentation)
      : undefined;
    md += technicalDocumentation
      ? `${technicalDocumentation}\n\n`
      : `*AI-authored documentation has not been generated for this component yet. Run the architecture agent to complete it.*\n\n`;

    md += `\n\n---\n\n*Generated by ArchiText AI Knowledge Exporter*\n`;

    files.push({
      path: relativePath,
      folder: folderName,
      filename,
      title: node.label,
      content: md,
      isIndex: false,
      componentId: node.id,
    });
  });

  // 2. Generate Main Root PROJECT_CONTEXT.md Overview
  let contextMd = `# PROJECT CONTEXT & SYSTEM ARCHITECTURE OVERVIEW\n\n`;
  contextMd += `> **PRIMARY CONTEXT FOR AI AGENTS**: This document serves as the master context and directory index for the application system architecture. AI coding assistants must use this overview to understand component responsibilities, group locations, and inter-service dependencies.\n\n`;

  contextMd += `## 1. High-Level System Topology\n`;
  contextMd += `- **Total Subgraphs / Group Folders**: ${groups.length}\n`;
  contextMd += `- **Total Architecture Component Files**: ${regularNodes.length}\n`;
  contextMd += `- **Total Service Connections**: ${edges.length}\n\n`;

  contextMd += `## 2. Directory Structure & File Map\n`;
  contextMd += `Below is the complete relative file location index for all component specifications:\n\n`;

  // Group by folder
  const folderGroups = new Map<string, ExportFileItem[]>();
  files.forEach((f) => {
    const list = folderGroups.get(f.folder) || [];
    list.push(f);
    folderGroups.set(f.folder, list);
  });

  folderGroups.forEach((items, folder) => {
    contextMd += `### 📁 Directory: \`./${folder}/\`\n`;
    items.forEach((item) => {
      contextMd += `- ${markdownFileLink(item.path, `**${item.title}**`)} — \`./${item.path}\`\n`;
    });
    contextMd += `\n`;
  });

  contextMd += `## 3. Global Technology Stack Matrix\n`;
  const allTech = Array.from(
    new Set(regularNodes.flatMap((n) => n.techStack || [])),
  );
  if (allTech.length > 0) {
    allTech.forEach((tech) => {
      const componentsWithTech = regularNodes
        .filter((n) => n.techStack?.includes(tech))
        .map((n) => n.label)
        .join(", ");
      contextMd += `- **${tech}**: Utilized by \`${componentsWithTech}\`\n`;
    });
  } else {
    contextMd += `*No specific global technologies defined.*\n`;
  }
  contextMd += `\n`;

  contextMd += `## 4. Component Context Digest\n\n`;
  contextMd += `Use this short, implementation-oriented digest to orient an AI coding agent before opening the linked component specifications. It intentionally summarizes responsibility; the component files remain the source of truth for contracts and operational detail.\n\n`;
  regularNodes.forEach((node) => {
    const parentId = node.parent;
    const folderName = parentId
      ? sanitizeName(groupMap.get(parentId) || parentId)
      : "General";
    const filePath = `./${folderName}/${sanitizeName(node.label || node.id)}.md`;
    contextMd += `- ${markdownFileLink(filePath.slice(2), `**${node.label}**`)} — ${contextSummary(node.description)}\n`;
  });
  contextMd += `\n`;

  contextMd += `## 5. Master Component File Registry\n\n`;
  contextMd += `| Component | Category | Relative File Path | Overview |\n`;
  contextMd += `| :--- | :--- | :--- | :--- |\n`;
  regularNodes.forEach((n) => {
    const parentId = n.parent;
    const folderName = parentId
      ? sanitizeName(groupMap.get(parentId) || parentId)
      : "General";
    const filePath = `./${folderName}/${sanitizeName(n.label || n.id)}.md`;
    contextMd += `| ${markdownFileLink(filePath.slice(2), n.label)} | \`${n.category || "COMPONENT"}\` | \`${filePath}\` | ${n.description || "N/A"} |\n`;
  });
  contextMd += `\n`;

  contextMd += `## 6. System Architecture Mermaid Blueprint\n\n`;
  contextMd += `\`\`\`mermaid\n${architectureBlueprint(editableDocument)}\n\`\`\`\n\n`;

  contextMd += `## 7. Guidelines for AI Agents Working on This Codebase\n`;
  contextMd += `1. **Consult Component Docs**: Before making modifications to any service or component, inspect its individual specification markdown in its group folder.\n`;
  contextMd += `2. **Respect Data Flows**: Maintain incoming and outgoing connection boundaries defined in the architecture graph.\n`;
  contextMd += `3. **Keep Context Updated**: Always ensure newly added features or services are registered in the appropriate group directory.\n\n`;
  contextMd += `4. **Read Before Editing**: Treat the Component Context Digest as orientation only; open the affected component specification before changing its behavior, dependencies, or data contracts.\n\n`;

  contextMd += `\n\n---\n\n*Generated by ArchiText AI Knowledge Exporter*\n`;

  // Prepend main PROJECT_CONTEXT.md file at root
  files.unshift({
    path: "PROJECT_CONTEXT.md",
    folder: "Root",
    filename: "PROJECT_CONTEXT.md",
    title: "PROJECT_CONTEXT.md (Master Architecture Index)",
    content: contextMd,
    isIndex: true,
  });

  return files;
}

export function downloadSingleMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadExportZip(
  files: ExportFileItem[],
  zipName: string = "architecture-ai-knowledge.zip",
) {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = zipName;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateProjectContextContent(mermaidDocument: string): string {
  const files = buildExportFileTree(mermaidDocument);
  const contextFile = files.find((f) => f.filename === "PROJECT_CONTEXT.md");
  return contextFile ? contextFile.content : "";
}

/**
 * Returns the complete, copy-ready documentation for a graph node. It reuses
 * the export generator so the modal and downloaded Markdown always contain the
 * same overview, stack, dependencies, and technical guidance. The export-only
 * title, file-location metadata, and generator footer are intentionally left
 * out of the node modal.
 */
export function getNodeDocumentationContent(
  architectureDocument: string,
  nodeId: string,
): string | undefined {
  const file = buildExportFileTree(architectureDocument).find(
    (item) => item.componentId === nodeId,
  );
  if (!file) return undefined;

  const firstSection = file.content.indexOf("## 1. Detailed Overview & Purpose");
  if (firstSection < 0) return file.content;

  return file.content
    .slice(firstSection)
    .replace(
      /\n{1,}---\n{1,}\*Generated by ArchiText AI Knowledge Exporter\*\s*$/,
      "",
    )
    // Also protect the node view from a trailing divider accidentally included
    // in legacy AI-authored technical notes.
    .replace(/\n{1,}---\s*$/, "")
    .trim();
}

export function syncProjectContextInDocument(fullDocument: string): string {
  const editableDocument = withoutProjectContext(fullDocument);
  const contextContent = generateProjectContextContent(editableDocument);
  return `${editableDocument}\n\n${contextContent}`;
}
