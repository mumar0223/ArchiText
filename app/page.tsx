"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ReactFlowProvider, Node } from "@xyflow/react";
import ArchitectureGraph from "@/components/ArchitectureGraph";
import Sidebar, { SidebarMessage } from "@/components/Sidebar";
import { ChatToolPart } from "@/components/ThinkingAccordion";
import EditingToolbar from "@/components/EditingToolbar";
import NodeDetailSidebar, {
  DetailSection,
} from "@/components/NodeDetailSidebar";
import FloatingCenterModal from "@/components/FloatingCenterModal";
import FloatingInputBox from "@/components/FloatingInputBox";
import ClarifyingQuestionsBox from "@/components/ClarifyingQuestionsBox";
import type { PendingQuestionFlow } from "@/lib/agent/questions";

import CustomDialogModal from "@/components/CustomDialogModal";
import ShortcutsModal from "@/components/ShortcutsModal";
import ExportModal from "@/components/ExportModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { parseMermaid, ParsedMermaidNode } from "@/lib/mermaid";
import { getNodeDocumentationContent } from "@/lib/markdownExport";
import { useProjects } from "@/hooks/useProjects";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Folder,
  Plus,
  Trash2,
  Save,
  Check,
  Loader2,
  Sparkles,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";

const initialDoc = "";

export default function Home() {
  const {
    projects,
    activeProjectId,
    activeProject,
    isInitialLoading,
    saveStatus,
    saveError,
    lastSavedTime,
    maxProjectsLimit,
    selectProject,
    handleCreateNewProject,
    handleDeleteProject,
    triggerAiTitleGenerator,
    autoSaveWorkspace,
  } = useProjects(initialDoc);

  const [document, setDocument] = useState(initialDoc);
  const [ghostDocument, setGhostDocument] = useState("");
  const [flowElements, setFlowElements] = useState<{
    nodes: Node[];
    edges: any[];
  }>({
    nodes: [],
    edges: [],
  });
  const [activeTool, setActiveTool] = useState<"select" | "move">("select");
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [activeDetailSection, setActiveDetailSection] =
    useState<DetailSection | null>(null);
  const [updatedNodeData, setUpdatedNodeData] = useState<{
    id: string;
    data: any;
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [pendingQuestionFlow, setPendingQuestionFlow] =
    useState<PendingQuestionFlow | null>(null);

  const [messages, setMessages] = useState<SidebarMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I can help you design your system architecture. Describe what you want to build or edit.",
    },
  ]);

  // Custom Dialog Modal States
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  const [isCanvasMoving, setIsCanvasMoving] = useState(false);
  const hydratedProjectIdRef = useRef<string | null>(null);
  const [targetedNodeLabels, setTargetedNodeLabels] = useState<string[]>([]);
  const [dismissedTargetLabels, setDismissedTargetLabels] = useState<string[]>(
    [],
  );

  // Sync state when active project changes
  useEffect(() => {
    if (activeProject) {
      // The values below originate from IndexedDB. Mark this render so the
      // autosave effect cannot mistake hydration/project switching for edits.
      hydratedProjectIdRef.current = activeProject.id;
      setDocument(activeProject.document || "");
      setGhostDocument("");
      setFlowElements({
        nodes: activeProject.nodes || [],
        edges: activeProject.edges || [],
      });
      setMessages(
        activeProject.messages && activeProject.messages.length > 0
          ? activeProject.messages
          : [
              {
                id: `init-${Date.now()}`,
                role: "assistant",
                content:
                  "Hello! I can help you design your system architecture. Describe what you want to build or edit.",
              },
            ],
      );
      setPendingQuestionFlow(activeProject.pendingQuestionFlow || null);
      setSelectedNodes([]);
      setTargetedNodeLabels([]);
      setActiveDetailSection(null);

      const releaseHydrationGuard = window.setTimeout(() => {
        if (hydratedProjectIdRef.current === activeProject.id) {
          hydratedProjectIdRef.current = null;
        }
      }, 0);
      return () => window.clearTimeout(releaseHydrationGuard);
    }
  }, [activeProject?.id]);

  // Auto-save whenever document, nodes, or messages change (only save nodes if document is non-empty)
  useEffect(() => {
    if (!isInitialLoading && activeProject) {
      if (hydratedProjectIdRef.current === activeProject.id) {
        return;
      }
      const nodesToSave = document.trim() ? flowElements.nodes : [];
      const edgesToSave = document.trim() ? flowElements.edges : [];
      autoSaveWorkspace(
        nodesToSave,
        edgesToSave,
        { x: 0, y: 0, zoom: 1 },
        document,
        messages,
        pendingQuestionFlow,
      );
    }
  }, [
    document,
    messages,
    flowElements.nodes,
    flowElements.edges,
    isInitialLoading,
    activeProject?.id,
    pendingQuestionFlow,
  ]);

  const handleSelectedNodesChange = useCallback((nodes: Node[]) => {
    setSelectedNodes(nodes);
    setDismissedTargetLabels([]);
    if (nodes.length !== 1) {
      setActiveDetailSection(null);
    }
  }, []);

  const handleNewProjectClick = async () => {
    const result = await handleCreateNewProject();
    if (!result.success) {
      setLimitWarning(result.error || "Project limit reached");
    }
  };

  const handlePromptSubmit = async (
    promptText: string,
    {
      allowQuestions = true,
      generateTitle = true,
      showUserMessage = true,
      resumeAssistantMessageId,
    }: {
      allowQuestions?: boolean;
      generateTitle?: boolean;
      showUserMessage?: boolean;
      resumeAssistantMessageId?: string;
    } = {},
  ) => {
    setIsAiLoading(true);

    // Trigger AI title generator on first prompt if default title
    if (generateTitle && activeProject && !activeProject.isTitleAiGenerated) {
      triggerAiTitleGenerator(promptText);
    }

    let fullPrompt = promptText;
    if (targetedNodeLabels.length > 0) {
      fullPrompt = `[Target Components: ${targetedNodeLabels.join(", ")}]\n${promptText}`;
    } else if (selectedNodes.length === 1) {
      const selectedLabel = selectedNodes[0].data?.label || selectedNodes[0].id;
      fullPrompt = `[Target Component: ${selectedLabel}]\n${promptText}`;
    }

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId =
      resumeAssistantMessageId || `assistant-${Date.now()}`;
    const startTime = Date.now();

    const userMsg: SidebarMessage = {
      id: userMsgId,
      role: "user",
      content: fullPrompt,
    };
    const assistantMsg: SidebarMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      thinkingText: "",
      toolInvocations: [],
      isThinkingActive: true,
      completedDuration: 0,
      startTime: startTime,
    };

    setMessages((prev) => {
      if (!resumeAssistantMessageId) {
        return showUserMessage
          ? [...prev, userMsg, assistantMsg]
          : [...prev, assistantMsg];
      }
      return prev.map((message) =>
        message.id === resumeAssistantMessageId
          ? {
              ...message,
              waitingForUserResponse: false,
              isThinkingActive: true,
              completedDuration: 0,
              startTime: startTime,
            }
          : message,
      );
    });

    const beginQuestionFlow = (
      questions: PendingQuestionFlow["questions"],
      waitingAssistantMessageId: string,
    ) => {
      setPendingQuestionFlow({
        assistantMessageId: waitingAssistantMessageId,
        originalPrompt: fullPrompt,
        targetLabels:
          targetedNodeLabels.length > 0
            ? targetedNodeLabels
            : selectedNodes.length === 1
              ? [
                  (selectedNodes[0].data?.label as string) ||
                    selectedNodes[0].id,
                ]
              : [],
        questions,
        answers: {},
        activeQuestionIndex: 0,
      });
    };

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          document,
          stream: true,
          allowQuestions,
        }),
      });

      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        const processLines = (linesToProcess: string[]) => {
          const parsedChunks: any[] = [];
          for (const line of linesToProcess) {
            if (!line.trim()) continue;
            try {
              parsedChunks.push(JSON.parse(line));
            } catch (e) {
              console.error("Error parsing NDJSON line:", e);
            }
          }

          if (parsedChunks.length > 0) {
            let latestDocToSet: string | null = null;
            const requestedQuestions = parsedChunks.reduce<
              PendingQuestionFlow["questions"] | null
            >((found, chunk) => {
              if (found) return found;
              const result =
                chunk.result !== undefined ? chunk.result : chunk.output;
              if (
                chunk.type === "questions-requested" &&
                Array.isArray(chunk.questions)
              ) {
                return chunk.questions;
              }
              if (
                chunk.type === "tool-result" &&
                chunk.toolName === "ask_user_questions" &&
                result?.awaitingUserAnswers &&
                Array.isArray(result.questions)
              ) {
                return result.questions;
              }
              return null;
            }, null);

            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id !== assistantMsgId) return msg;

                const updatedMsg = { ...msg };
                const toolInvocations = updatedMsg.toolInvocations
                  ? [...updatedMsg.toolInvocations]
                  : [];

                for (const chunk of parsedChunks) {
                  const toolResultObj =
                    chunk.result !== undefined ? chunk.result : chunk.output;

                  if (chunk.type === "text-delta" && chunk.textDelta) {
                    updatedMsg.content =
                      (updatedMsg.content || "") + chunk.textDelta;
                  } else if (chunk.type === "reasoning" && chunk.textDelta) {
                    updatedMsg.thinkingText =
                      (updatedMsg.thinkingText || "") + chunk.textDelta;
                  } else if (
                    chunk.type === "project-context-finalized" &&
                    chunk.updatedDocument
                  ) {
                    latestDocToSet = chunk.updatedDocument;
                  } else if (
                    chunk.type === "completion-summary" &&
                    chunk.text
                  ) {
                    // Tool-only model runs often have no text deltas. Replace
                    // any partial model wording with the factual final handoff.
                    updatedMsg.content = chunk.text;
                  } else if (
                    chunk.type === "questions-requested" &&
                    Array.isArray(chunk.questions)
                  ) {
                    updatedMsg.isThinkingActive = false;
                    updatedMsg.waitingForUserResponse = true;
                  } else if (
                    chunk.type === "tool-call" ||
                    chunk.type === "tool-result"
                  ) {
                    const idx = toolInvocations.findIndex(
                      (t) => t.toolInvocation.toolCallId === chunk.toolCallId,
                    );
                    if (idx >= 0) {
                      toolInvocations[idx] = {
                        ...toolInvocations[idx],
                        toolInvocation: {
                          ...toolInvocations[idx].toolInvocation,
                          state:
                            chunk.type === "tool-result" ? "result" : "call",
                          result:
                            toolResultObj ||
                            toolInvocations[idx].toolInvocation.result,
                        },
                      };
                    } else {
                      toolInvocations.push({
                        type: "tool-invocation",
                        toolInvocation: {
                          toolCallId: chunk.toolCallId,
                          toolName: chunk.toolName,
                          args: chunk.args,
                          state:
                            chunk.type === "tool-result" ? "result" : "call",
                          result: toolResultObj,
                        },
                      });
                    }
                    if (toolResultObj?.updatedDocument) {
                      latestDocToSet = toolResultObj.updatedDocument;
                    }
                    if (
                      chunk.type === "tool-result" &&
                      chunk.toolName === "ask_user_questions" &&
                      toolResultObj?.awaitingUserAnswers &&
                      Array.isArray(toolResultObj.questions)
                    ) {
                      updatedMsg.isThinkingActive = false;
                      updatedMsg.waitingForUserResponse = true;
                    }
                  }
                }

                updatedMsg.toolInvocations = toolInvocations;
                return updatedMsg;
              }),
            );

            if (latestDocToSet) {
              setDocument(latestDocToSet);
            }

            if (requestedQuestions) {
              beginQuestionFlow(requestedQuestions, assistantMsgId);
            }
          }
        };

        if (lines.length > 0) {
          processLines(lines);
        }
      }

      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          const requestedQuestions =
            chunk.type === "questions-requested" &&
            Array.isArray(chunk.questions)
              ? chunk.questions
              : null;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== assistantMsgId) return msg;
              const updatedMsg = { ...msg };
              if (chunk.type === "text-delta" && chunk.textDelta) {
                updatedMsg.content =
                  (updatedMsg.content || "") + chunk.textDelta;
              } else if (
                chunk.type === "questions-requested" &&
                Array.isArray(chunk.questions)
              ) {
                updatedMsg.isThinkingActive = false;
                updatedMsg.waitingForUserResponse = true;
              }
              return updatedMsg;
            }),
          );
          if (requestedQuestions) {
            beginQuestionFlow(requestedQuestions, assistantMsgId);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error("AI Prompt error:", err);
    } finally {
      const elapsed = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              ...msg,
              isThinkingActive: false,
              completedDuration: elapsed,
            };
          }
          return msg;
        }),
      );
      setIsAiLoading(false);
    }
  };

  const handleQuestionFlowSubmit = () => {
    if (!pendingQuestionFlow) return;
    const responseContext = pendingQuestionFlow.questions
      .map((question) => {
        const answer = pendingQuestionFlow.answers[question.id];
        return answer
          ? `Question: ${question.question}\nAnswer: ${answer.value}`
          : "";
      })
      .filter(Boolean)
      .join("\n\n");

    setMessages((previous) =>
      previous.map((message) => {
        if (message.id !== pendingQuestionFlow.assistantMessageId)
          return message;
        return {
          ...message,
          waitingForUserResponse: false,
          toolInvocations: message.toolInvocations?.map((part) =>
            part.toolInvocation.toolName === "ask_user_questions"
              ? {
                  ...part,
                  toolInvocation: {
                    ...part.toolInvocation,
                    result: {
                      ...(part.toolInvocation.result || {}),
                      awaitingUserAnswers: false,
                      answers: responseContext,
                    },
                  },
                }
              : part,
          ),
        };
      }),
    );
    setPendingQuestionFlow(null);
    void handlePromptSubmit(
      `[ask_user_questions tool result]\n${responseContext}\n\nContinue the original request using these decisions.`,
      {
        allowQuestions: false,
        generateTitle: false,
        showUserMessage: false,
        resumeAssistantMessageId: pendingQuestionFlow.assistantMessageId,
      },
    );
  };

  const selectedSingleNode =
    selectedNodes.length === 1 ? selectedNodes[0] : null;

  // Format timestamp helper
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground overflow-hidden transition-colors">
      {/* Top Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-2.5 border-b border-border-subtle shrink-0 bg-panel-header z-10 transition-colors">
        {/* Left: Branding & Project Selector */}
        <div className="flex items-center space-x-4">
          <span className="font-serif italic text-2xl font-bold tracking-tight text-foreground">
            ArchiText.
          </span>

          <div className="h-4 w-px bg-border-subtle" />

          {/* Project Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border hover:bg-muted transition-colors text-xs font-semibold text-foreground shadow-[2px_2px_0px_0px_var(--shadow-color)] outline-none">
              <Folder size={14} className="text-primary" />
              <span className="max-w-[200px] truncate">
                {activeProject?.name || "Untitled Architecture"}
              </span>
              <ChevronDown size={14} className="text-muted-foreground ml-1" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-72 p-1.5">
              <DropdownMenuLabel className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground px-2 py-1 flex justify-between items-center">
                <span>
                  Projects ({projects.length}/{maxProjectsLimit})
                </span>
                <span className="text-[9px] lowercase opacity-70">
                  Saved locally
                </span>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <div className="flex flex-col gap-1.5 my-1">
                {projects.map((proj) => (
                  <DropdownMenuItem
                    key={proj.id}
                    onClick={() => selectProject(proj.id)}
                    className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                      proj.id === activeProjectId
                        ? "bg-primary/10 text-primary font-bold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex flex-col overflow-hidden max-w-[190px]">
                      <span className="truncate text-xs font-medium">
                        {proj.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Created: {formatTime(proj.createdAt)}
                      </span>
                    </div>
                    {proj.id === activeProjectId ? (
                      <Check size={14} className="text-primary shrink-0" />
                    ) : (
                      projects.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(proj.id);
                          }}
                          title="Delete project"
                          className="p-1.5 hover:text-red-500 hover:bg-red-500/10 rounded cursor-pointer text-muted-foreground transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </DropdownMenuItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleNewProjectClick}
                disabled={projects.length >= maxProjectsLimit}
                className="flex items-center gap-2 p-2 text-xs font-semibold text-primary cursor-pointer hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                <span>Create New Project</span>
                {projects.length >= maxProjectsLimit && (
                  <span className="ml-auto text-[9px] text-red-500 uppercase">
                    Limit Reached
                  </span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Quick Direct "+ New Project" Button */}
          <button
            onClick={handleNewProjectClick}
            disabled={projects.length >= maxProjectsLimit}
            title="Create New Project"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground hover:bg-muted text-xs font-semibold shadow-[2px_2px_0px_0px_var(--shadow-color)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} className="text-primary" />
            <span className="hidden sm:inline">New Project</span>
          </button>

          {/* Auto-Save Status Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2">
            {saveStatus === "loading" ? (
              <>
                <Loader2 size={12} className="animate-spin text-sky-400" />
                <span className="text-[11px] italic">Loading project...</span>
              </>
            ) : saveStatus === "pending" ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[11px]">Changes pending</span>
              </>
            ) : saveStatus === "saving" ? (
              <>
                <Loader2 size={12} className="animate-spin text-orange-400" />
                <span className="text-[11px] italic">Saving...</span>
              </>
            ) : saveStatus === "error" ? (
              <>
                <AlertTriangle size={13} className="text-red-400" />
                <span
                  className="text-[11px] text-red-400"
                  title={saveError || undefined}
                >
                  Save failed
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px]">
                  {lastSavedTime
                    ? `Saved ${formatTime(lastSavedTime)}`
                    : "Saved locally"}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <button
            onClick={() => setIsExportOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs uppercase tracking-widest font-semibold hover:opacity-80 transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)] border border-border"
          >
            Export Blueprint
          </button>
        </div>
      </nav>

      {/* Main Canvas Viewport with Floating Controls */}
      <main className="flex-1 relative overflow-hidden bg-canvas-bg">
        <ReactFlowProvider>
          {/* Main Diagram Canvas */}
          <ArchitectureGraph
            document={document}
            onDocumentChange={setDocument}
            activeTool={activeTool}
            onSelectedNodesChange={handleSelectedNodesChange}
            updatedNodeData={updatedNodeData}
            onCanvasMoveChange={setIsCanvasMoving}
            onGhostDocumentChange={setGhostDocument}
            onNodesEdgesChange={(nodes, edges) =>
              setFlowElements({ nodes, edges })
            }
            initialNodes={flowElements.nodes}
            initialEdges={flowElements.edges}
            isProjectLoading={isInitialLoading || saveStatus === "loading"}
          />

          {/* Floating Left Sidebar */}
          <Sidebar
            document={document}
            onDocumentChange={setDocument}
            messages={messages}
            isLoading={isAiLoading}
            ghostDocument={ghostDocument}
          />

          {/* Right Side Control: Single Node Detail Menu OR Functional Editing Toolbar */}
          {selectedSingleNode ? (
            (() => {
              const parsedDoc = parseMermaid(document);
              const currentNodeData = parsedDoc.nodes.find(
                (node: ParsedMermaidNode) => node.id === selectedSingleNode.id,
              );
              const isGroupNode =
                selectedSingleNode.type === "group" ||
                selectedSingleNode.data?.isGroup ||
                currentNodeData?.type === "group";
              const childNodes: ParsedMermaidNode[] = isGroupNode
                ? parsedDoc.nodes.filter(
                    (n: ParsedMermaidNode) =>
                      n.parent === selectedSingleNode.id,
                  )
                : [];

              const effectiveTechStack: string[] = isGroupNode
                ? Array.from(
                    new Set(
                      childNodes.flatMap(
                        (c: ParsedMermaidNode) => c.techStack || [],
                      ),
                    ),
                  )
                : currentNodeData?.techStack ||
                  (selectedSingleNode.data?.techStack as string[]) ||
                  [];

              const effectiveDescription = isGroupNode
                ? `Group '${selectedSingleNode.data?.label || selectedSingleNode.id}' containing ${childNodes.length} component(s): ${childNodes.map((c: ParsedMermaidNode) => c.label).join(", ")}.`
                : currentNodeData?.description ||
                  (selectedSingleNode.data?.description as string);

              const effectiveDoc = isGroupNode
                ? `# Group: ${selectedSingleNode.data?.label || selectedSingleNode.id}\n\nGroup container holding **${childNodes.length}** components.\n\n### Aggregated Tech Stack\n${effectiveTechStack.map((t: string) => `- **${t}**`).join("\n") || "- *None specified*"}\n\n---\n\n### Included Components\n\n${childNodes.map((c: ParsedMermaidNode) => `#### ${c.label} (${c.id})\n**Category**: ${c.category || "COMPONENT"}\n\n${c.documentation || c.description || "No documentation specified."}`).join("\n\n---\n\n")}`
                : currentNodeData?.documentation ||
                  (selectedSingleNode.data?.documentation as string);
              const fullNodeDocumentation = isGroupNode
                ? effectiveDoc
                : getNodeDocumentationContent(
                    document,
                    selectedSingleNode.id,
                  ) || effectiveDoc;

              const nodeProp = {
                id: selectedSingleNode.id,
                label:
                  currentNodeData?.label ||
                  (selectedSingleNode.data?.label as string) ||
                  selectedSingleNode.id,
                category: isGroupNode
                  ? "GROUP CONTAINER"
                  : currentNodeData?.category ||
                    (selectedSingleNode.data?.category as string),
                description: effectiveDescription,
                techStack: effectiveTechStack,
                documentation: effectiveDoc,
                displayDocumentation: fullNodeDocumentation,
              };

              return (
                <>
                  <NodeDetailSidebar
                    node={nodeProp}
                    activeSection={activeDetailSection}
                    onSelectSection={(section) =>
                      setActiveDetailSection(section)
                    }
                    onClose={() => {
                      setSelectedNodes([]);
                      setActiveDetailSection(null);
                    }}
                  />

                  {activeDetailSection && (
                    <FloatingCenterModal
                      node={nodeProp}
                      activeSection={activeDetailSection}
                      onUpdateNode={(updated) => {
                        setUpdatedNodeData({
                          id: selectedSingleNode.id,
                          data: updated,
                        });
                      }}
                      onClose={() => {
                        setSelectedNodes([]);
                        setActiveDetailSection(null);
                      }}
                    />
                  )}
                </>
              );
            })()
          ) : (
            <EditingToolbar
              activeTool={activeTool}
              onToolChange={(tool) => setActiveTool(tool)}
              onHelp={() => setIsHelpOpen(true)}
            />
          )}

          {/* Custom Dialog Modals */}
          <ShortcutsModal
            isOpen={isHelpOpen}
            onClose={() => setIsHelpOpen(false)}
          />

          <CustomDialogModal
            isOpen={!!limitWarning}
            title="Project Limit Reached (Max 5)"
            description={
              limitWarning ||
              "You have reached the maximum limit of 5 saved projects. Please delete an existing project from the dropdown before creating a new one."
            }
            type="alert"
            onConfirm={() => setLimitWarning(null)}
            onClose={() => setLimitWarning(null)}
          />

          <ExportModal
            isOpen={isExportOpen}
            document={document}
            onDocumentChange={setDocument}
            onClose={() => setIsExportOpen(false)}
          />

          {/* Prompt input is replaced by the persisted clarification flow when needed. */}
          {pendingQuestionFlow ? (
            <ClarifyingQuestionsBox
              flow={pendingQuestionFlow}
              onChange={setPendingQuestionFlow}
              onSubmit={handleQuestionFlowSubmit}
              isLoading={isAiLoading}
            />
          ) : (
            <FloatingInputBox
              selectedNodeLabel={
                selectedSingleNode
                  ? (selectedSingleNode.data?.label as string) ||
                    selectedSingleNode.id
                  : undefined
              }
              selectedNodeLabels={targetedNodeLabels}
              dismissedNodeLabels={dismissedTargetLabels}
              multiSelectCount={selectedNodes.length}
              showMultiTargetButton={
                selectedNodes.length >= 2 &&
                selectedNodes.some(
                  (n) =>
                    !targetedNodeLabels.includes(
                      (n.data?.label as string) || n.id,
                    ),
                )
              }
              onTargetMultiSelect={() => {
                const labels = selectedNodes.map(
                  (n) => (n.data?.label as string) || n.id,
                );
                setTargetedNodeLabels((prev) =>
                  Array.from(new Set([...prev, ...labels])),
                );
              }}
              isCanvasMoving={isCanvasMoving}
              onClearSelectedNode={() => {
                setSelectedNodes([]);
                setTargetedNodeLabels([]);
                setActiveDetailSection(null);
              }}
              onRemoveNodeLabel={(labelToRemove) => {
                setTargetedNodeLabels((prev) =>
                  prev.filter((lbl) => lbl !== labelToRemove),
                );
                setDismissedTargetLabels((prev) => [...prev, labelToRemove]);
              }}
              onSubmit={handlePromptSubmit}
              isLoading={isAiLoading}
            />
          )}
        </ReactFlowProvider>
      </main>
    </div>
  );
}
