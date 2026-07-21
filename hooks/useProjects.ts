"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  db,
  ProjectRecord,
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject,
  createNewProject,
  MAX_PROJECTS_LIMIT,
} from "@/lib/db";
import type { Node, Edge, Viewport } from "@xyflow/react";
import type { SidebarMessage } from "@/components/Sidebar";
import type { PendingQuestionFlow } from "@/lib/agent/questions";

const LAST_ACTIVE_PROJECT_KEY = "architext_last_active_project_id";

export type ProjectSaveStatus =
  | "loading"
  | "pending"
  | "saving"
  | "saved"
  | "error";

export function useProjects(initialDoc: string = "") {
  const projects =
    useLiveQuery(() => db.projects.orderBy("updatedAt").reverse().toArray(), []) ||
    [];
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<ProjectRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<ProjectSaveStatus>("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [isTitleGenerating, setIsTitleGenerating] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);

  const clearPendingSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPendingSave(), [clearPendingSave]);

  // Initialize the workspace before any automatic save is allowed.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setSaveStatus("loading");
      setSaveError(null);
      try {
        let all = await getAllProjects();
        let currentId = localStorage.getItem(LAST_ACTIVE_PROJECT_KEY);

        if (all.length === 0) {
          const fresh = await createNewProject(initialDoc);
          currentId = fresh.id;
          all = [fresh];
        } else if (!currentId || !all.some((project) => project.id === currentId)) {
          currentId = all[0].id;
        }

        const projectToLoad = all.find((project) => project.id === currentId) || all[0];
        if (cancelled || !projectToLoad) return;

        activeProjectIdRef.current = projectToLoad.id;
        setActiveProjectId(projectToLoad.id);
        setActiveProject(projectToLoad);
        localStorage.setItem(LAST_ACTIVE_PROJECT_KEY, projectToLoad.id);
        setLastSavedTime(projectToLoad.updatedAt);
        setSaveStatus("saved");
      } catch (err: any) {
        if (!cancelled) {
          console.error("[USE_PROJECTS INITIALIZATION ERROR]:", err);
          setSaveError(err?.message || "Could not load the project.");
          setSaveStatus("error");
        }
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [initialDoc]);

  const selectProject = useCallback(
    async (id: string) => {
      if (id === activeProjectIdRef.current) return;
      clearPendingSave();
      setSaveStatus("loading");
      setSaveError(null);
      try {
        const target = await getProjectById(id);
        if (!target) throw new Error("The selected project could not be found.");

        activeProjectIdRef.current = target.id;
        setActiveProjectId(target.id);
        setActiveProject(target);
        localStorage.setItem(LAST_ACTIVE_PROJECT_KEY, target.id);
        setLastSavedTime(target.updatedAt);
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("[PROJECT SWITCH ERROR]:", err);
        setSaveError(err?.message || "Could not load the selected project.");
        setSaveStatus("error");
      }
    },
    [clearPendingSave],
  );

  const handleCreateNewProject = useCallback(async () => {
    clearPendingSave();
    setSaveStatus("loading");
    setSaveError(null);
    try {
      const newProject = await createNewProject(initialDoc);
      activeProjectIdRef.current = newProject.id;
      setActiveProjectId(newProject.id);
      setActiveProject(newProject);
      localStorage.setItem(LAST_ACTIVE_PROJECT_KEY, newProject.id);
      setLastSavedTime(newProject.updatedAt);
      setSaveStatus("saved");
      return { success: true, project: newProject };
    } catch (err: any) {
      const error = err?.message || "Failed to create a new project.";
      setSaveError(error);
      setSaveStatus("error");
      return { success: false, error };
    }
  }, [clearPendingSave, initialDoc]);

  const handleDeleteProject = useCallback(
    async (id: string) => {
      clearPendingSave();
      setSaveStatus("loading");
      setSaveError(null);
      try {
        await deleteProject(id);
        const remaining = await getAllProjects();
        const next = remaining[0] || (await createNewProject(initialDoc));
        activeProjectIdRef.current = next.id;
        setActiveProjectId(next.id);
        setActiveProject(next);
        localStorage.setItem(LAST_ACTIVE_PROJECT_KEY, next.id);
        setLastSavedTime(next.updatedAt);
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("[PROJECT DELETE ERROR]:", err);
        setSaveError(err?.message || "Could not delete the project.");
        setSaveStatus("error");
      }
    },
    [clearPendingSave, initialDoc],
  );

  const triggerAiTitleGenerator = useCallback(
    async (firstPrompt: string) => {
      if (!activeProject || activeProject.isTitleAiGenerated || isTitleGenerating) return;

      setIsTitleGenerating(true);
      try {
        const res = await fetch("/api/generate-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: firstPrompt }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            const updated = {
              ...activeProject,
              name: data.title,
              isTitleAiGenerated: true,
              updatedAt: Date.now(),
            };
            setActiveProject(updated);
            await saveProject(updated);
          }
        }
      } catch (error) {
        console.error("[AI TITLE GENERATION ERROR]:", error);
      } finally {
        setIsTitleGenerating(false);
      }
    },
    [activeProject, isTitleGenerating],
  );

  const autoSaveWorkspace = useCallback(
    (
      nodes: Node[],
      edges: Edge[],
      viewport: Viewport,
      documentState: string,
      messagesState: SidebarMessage[],
      pendingQuestionFlow?: PendingQuestionFlow | null,
    ) => {
      if (!activeProjectId || !activeProject || isInitialLoading) return;

      clearPendingSave();
      const projectIdAtSchedule = activeProjectId;
      const projectAtSchedule = activeProject;
      setSaveError(null);
      setSaveStatus("pending");

      autoSaveTimerRef.current = setTimeout(async () => {
        if (activeProjectIdRef.current !== projectIdAtSchedule) return;
        setSaveStatus("saving");
        try {
          const updatedRecord: ProjectRecord = {
            ...projectAtSchedule,
            id: projectIdAtSchedule,
            nodes,
            edges,
            viewport,
            document: documentState,
            messages: messagesState,
            pendingQuestionFlow: pendingQuestionFlow || undefined,
            updatedAt: Date.now(),
          };

          await saveProject(updatedRecord);
          if (activeProjectIdRef.current !== projectIdAtSchedule) return;
          setActiveProject(updatedRecord);
          setLastSavedTime(updatedRecord.updatedAt);
          setSaveStatus("saved");
        } catch (err: any) {
          if (activeProjectIdRef.current !== projectIdAtSchedule) return;
          console.error("[AUTO SAVE ERROR]:", err);
          setSaveError(err?.message || "Could not save your changes.");
          setSaveStatus("error");
        }
      }, 800);
    },
    [activeProjectId, activeProject, clearPendingSave, isInitialLoading],
  );

  return {
    projects,
    activeProjectId,
    activeProject,
    isInitialLoading,
    isTitleGenerating,
    saveStatus,
    saveError,
    lastSavedTime,
    maxProjectsLimit: MAX_PROJECTS_LIMIT,
    selectProject,
    handleCreateNewProject,
    handleDeleteProject,
    triggerAiTitleGenerator,
    autoSaveWorkspace,
  };
}
