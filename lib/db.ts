import Dexie, { type Table } from "dexie";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type { SidebarMessage } from "@/components/Sidebar";
import type { PendingQuestionFlow } from "@/lib/agent/questions";

export const MAX_PROJECTS_LIMIT = 5;

export interface ProjectRecord {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  document: string;
  messages: SidebarMessage[];
  pendingQuestionFlow?: PendingQuestionFlow;
  isTitleAiGenerated?: boolean;
  createdAt: number;
  updatedAt: number;
}

export class ArchitectureDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;

  constructor() {
    super("AiArchitectureWorkspaceDB");

    this.version(1).stores({
      projects: "id, updatedAt, createdAt, name",
    });
  }
}

export const db = new ArchitectureDatabase();

/**
 * Get count of all saved projects
 */
export async function getProjectsCount(): Promise<number> {
  return await db.projects.count();
}

/**
 * Fetch all projects sorted by most recently updated
 */
export async function getAllProjects(): Promise<ProjectRecord[]> {
  return await db.projects.orderBy("updatedAt").reverse().toArray();
}

/**
 * Fetch a single project by ID
 */
export async function getProjectById(
  id: string,
): Promise<ProjectRecord | undefined> {
  return await db.projects.get(id);
}

function sanitizeNodes(nodes: Node[] = []): Node[] {
  return nodes.map((n) => {
    if (!n || !n.data) return n;
    const cleanData: Record<string, any> = {};
    for (const key of Object.keys(n.data)) {
      if (typeof (n.data as any)[key] !== "function") {
        cleanData[key] = (n.data as any)[key];
      }
    }
    return {
      ...n,
      data: cleanData,
    };
  });
}

/**
 * Save or update a project record
 */
export async function saveProject(project: ProjectRecord): Promise<string> {
  const cleanProject: ProjectRecord = {
    ...project,
    nodes: sanitizeNodes(project.nodes),
    updatedAt: Date.now(),
  };
  await db.projects.put(cleanProject);
  return project.id;
}

/**
 * Delete a project by ID
 */
export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

/**
 * Create a new empty project record (checks max 5 limit)
 */
export async function createNewProject(
  initialDoc: string = "",
): Promise<ProjectRecord> {
  const count = await getProjectsCount();
  if (count >= MAX_PROJECTS_LIMIT) {
    throw new Error(
      `Project limit reached (${MAX_PROJECTS_LIMIT}/${MAX_PROJECTS_LIMIT}). Please delete an existing project before creating a new one.`,
    );
  }

  const now = Date.now();
  const newProject: ProjectRecord = {
    id: `proj_${now}_${Math.random().toString(36).substr(2, 4)}`,
    name: `Untitled Architecture ${count + 1}`,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    document: initialDoc,
    messages: [
      {
        id: `init-${now}`,
        role: "assistant",
        content:
          "Hello! I can help you design your system architecture. Describe what you want to build or edit.",
      },
    ],
    isTitleAiGenerated: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.projects.put(newProject);
  return newProject;
}
