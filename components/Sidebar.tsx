"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, Code, Terminal, Check, X, Pencil, Copy, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ThinkingAccordion,
  ChatToolPart,
  parseMessageContent,
} from "./ThinkingAccordion";

export interface SidebarMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  thinkingText?: string;
  toolInvocations?: ChatToolPart[];
  isThinkingActive?: boolean;
  waitingForUserResponse?: boolean;
  completedDuration?: number;
  startTime?: number;
}

const DEMO_GHOST_DOC = `# System Architecture (Demo)

\`\`\`architecture
flowchart LR
  subgraph Frontend
    App[Web Application]
  end
  subgraph Backend
    API[API Service]
    DB[(PostgreSQL Database)]
  end
  App --> API
  API --> DB
\`\`\``;

interface SidebarProps {
  document: string;
  onDocumentChange: (doc: string) => void;
  messages?: SidebarMessage[];
  isLoading?: boolean;
  ghostDocument?: string;
}

export default function Sidebar({
  document,
  onDocumentChange,
  messages: externalMessages,
  isLoading: externalIsLoading,
  ghostDocument,
}: SidebarProps) {
  const [internalMessages] = useState<SidebarMessage[]>([
    {
      id: "init",
      role: "assistant",
      content:
        "Hello! I can help you design your system architecture. Describe what you want to build or edit.",
    },
  ]);
  const [activeTab, setActiveTab] = useState<"chat" | "doc">("chat");
  const [isDocEditable, setIsDocEditable] = useState(false);
  const [tempDoc, setTempDoc] = useState(document);
  const [isCopied, setIsCopied] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const effectiveDisplayDoc = document.trim() ? document : DEMO_GHOST_DOC;

  useEffect(() => {
    if (!isDocEditable) {
      setTempDoc(document);
    }
  }, [document, isDocEditable]);

  const messages = externalMessages || internalMessages;
  const isLoading = externalIsLoading || false;

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (!container) return;
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
    container.scrollTo({ top: container.scrollHeight, behavior });
  };

  const handleChatScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearBottom = distanceFromBottom < 56;
    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom && distanceFromBottom > 72);
  };

  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;
    const frame = requestAnimationFrame(() => scrollToBottom("auto"));
    return () => cancelAnimationFrame(frame);
  }, [messages, isLoading]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    handleChatScroll();
    const observer = new ResizeObserver(() => {
      handleChatScroll();
    });
    Array.from(container.children).forEach((child) => observer.observe(child));
    observer.observe(container);
    return () => observer.disconnect();
  }, [messages]);

  return (
    <div className="absolute top-4 left-4 bottom-4 z-20 w-84 bg-panel-bg border border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] flex flex-col overflow-hidden transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-panel-header border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-foreground" />
          <span className="font-serif italic font-bold text-sm text-foreground">
            Agent Process Log
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle bg-muted shrink-0">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest ${
            activeTab === "chat"
              ? "bg-card text-foreground border-b-2 border-orange-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Terminal size={13} /> Agent Log
          </div>
        </button>
        <button
          onClick={() => setActiveTab("doc")}
          className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-widest ${
            activeTab === "doc"
              ? "bg-card text-foreground border-b-2 border-orange-500"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Code size={13} /> Doc Code
          </div>
        </button>
      </div>

      {activeTab === "chat" ? (
        <div className="relative flex-1 flex flex-col overflow-hidden min-h-0">
          <div
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-panel-bg"
            ref={scrollRef}
            onScroll={handleChatScroll}
          >
            {messages.map((msg, i) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id || i} className="flex justify-end">
                    <div className="user-message-bubble max-w-[90%] bg-primary text-primary-foreground px-3.5 py-2.5 text-xs leading-relaxed shadow-sm">
                      <div className="prose prose-sm max-w-none dark:prose-invert text-primary-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                );
              }

              const { extractedThinking, cleanResponse } = parseMessageContent(
                msg.content,
                msg.thinkingText,
              );
              const hasThinkingOrTools =
                !!extractedThinking ||
                !!(msg.toolInvocations && msg.toolInvocations.length > 0) ||
                !!msg.isThinkingActive ||
                !!msg.waitingForUserResponse;

              return (
                <div key={msg.id || i} className="flex justify-start w-full">
                  <div className="w-full bg-card border border-border-subtle p-3 text-xs leading-relaxed shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                      <div className="w-5 h-5 rounded-none bg-primary flex items-center justify-center shrink-0">
                        <span className="text-[9px] text-primary-foreground font-bold">
                          AI
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-foreground font-mono">
                        ArchiText Agent
                      </span>
                    </div>

                    {/* Single Unified Thinking Accordion */}
                    {hasThinkingOrTools && (
                      <ThinkingAccordion
                        thinkingText={extractedThinking}
                        toolInvocations={msg.toolInvocations}
                        isActive={!!msg.isThinkingActive}
                        completedDuration={msg.completedDuration || 0}
                        waitingForUserResponse={!!msg.waitingForUserResponse}
                        startTime={msg.startTime}
                      />
                    )}

                    {/* Final AI Response / Walkthrough */}
                    {cleanResponse ? (
                      <div className="prose prose-sm max-w-none text-foreground dark:prose-invert pt-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {cleanResponse}
                        </ReactMarkdown>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {isLoading &&
              (!messages.length ||
                !messages[messages.length - 1]?.isThinkingActive) && (
                <div className="flex justify-start">
                  <div className="bg-card border border-border-subtle px-3 py-2 shadow-sm flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2
                      size={14}
                      className="animate-spin text-orange-500"
                    />{" "}
                    Initializing agent stream...
                  </div>
                </div>
            )}
          </div>
          {showScrollToBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card text-foreground shadow-md transition-all hover:bg-muted hover:scale-105 active:scale-95 cursor-pointer z-30"
              aria-label="Scroll to bottom"
            >
              <ChevronDown size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-panel-bg overflow-hidden min-h-0">
          <div className="p-2.5 border-b border-border-subtle bg-panel-header flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">
                Document Code
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 border ${
                  isDocEditable
                    ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30"
                    : "bg-muted text-muted-foreground border-border-subtle"
                }`}
              >
                {isDocEditable ? "EDIT MODE" : "READ ONLY"}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Copy Document Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    isDocEditable ? tempDoc : document,
                  );
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                title={isCopied ? "Copied to clipboard!" : "Copy Document Code"}
                className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center"
              >
                {isCopied ? (
                  <Check size={13} className="text-green-500" />
                ) : (
                  <Copy size={13} />
                )}
              </button>

              {isDocEditable ? (
                <>
                  {/* Tick / Confirm Button */}
                  <button
                    onClick={() => {
                      onDocumentChange(tempDoc);
                      setIsDocEditable(false);
                    }}
                    title="Apply & Save Changes"
                    className="p-1.5 bg-green-600 text-white hover:bg-green-700 transition-colors border border-green-700 shadow-xs flex items-center justify-center"
                  >
                    <Check size={13} />
                  </button>

                  {/* Cancel / Revert Button */}
                  <button
                    onClick={() => {
                      setTempDoc(document);
                      setIsDocEditable(false);
                    }}
                    title="Cancel & Revert Changes"
                    className="p-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors border border-red-700 shadow-xs flex items-center justify-center"
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                /* Single Edit Mode Button */
                <button
                  onClick={() => {
                    setTempDoc(document);
                    setIsDocEditable(true);
                  }}
                  title="Enter Edit Mode"
                  className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center cursor-pointer"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>

          {isDocEditable ? (
            <textarea
              value={tempDoc}
              onChange={(e) => setTempDoc(e.target.value)}
              placeholder={ghostDocument || DEMO_GHOST_DOC}
              className="flex-1 w-full p-4 text-xs font-mono bg-panel-bg outline-none resize-none leading-relaxed placeholder:text-muted-foreground/50 placeholder:italic"
              spellCheck={false}
            />
          ) : (
            <div
              className={`flex-1 overflow-y-auto p-4 bg-panel-bg text-xs leading-relaxed font-mono whitespace-pre-wrap selection:bg-primary selection:text-primary-foreground border-t border-border-subtle ${!document.trim() ? "text-muted-foreground/50 italic" : "text-foreground"}`}
            >
              {effectiveDisplayDoc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
