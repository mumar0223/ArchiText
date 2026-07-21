"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Loader2, Check, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export interface ChatToolInvocation {
  toolCallId: string;
  toolName: string;
  args?: any;
  state?: "call" | "result";
  result?: any;
}

export interface ChatToolPart {
  type: "tool-invocation";
  toolInvocation: ChatToolInvocation;
}

export function cleanThinkingText(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<(thinking|thought)>[\s\S]*?<\/\1>/gi, "");
  // Clean up any unclosed tags at the end of the text
  cleaned = cleaned.replace(/<(thinking|thought)>[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/([a-z])([.!?])([A-Z])/g, "$1$2 $3");
  return cleaned.trim();
}

export function parseMessageContent(
  rawContent: string,
  thinkingTextProp?: string,
) {
  let extractedThinking = thinkingTextProp || "";
  const match = rawContent.match(/<(thinking|thought)>([\s\S]*?)(?:<\/\1>|$)/i);
  if (match) {
    if (extractedThinking && !extractedThinking.includes(match[2].trim())) {
      extractedThinking += "\n" + match[2].trim();
    } else if (!extractedThinking) {
      extractedThinking = match[2].trim();
    }
  }
  const cleanResponse = cleanThinkingText(rawContent);
  return { extractedThinking, cleanResponse };
}

export function summarizeToolCall(toolCall: any): string {
  if (!toolCall) return "";
  const name = toolCall.toolName || toolCall.name || "Tool Execution";
  const toolLabels: Record<string, string> = {
    inspect_architecture: "Inspecting architecture topology & documentation coverage",
    validate_documentation_completeness: "Checking documentation coverage for every component",
    read_markdown_lines: "Inspecting architecture document lines",
    replace_markdown_lines: "Applying line-by-line markdown edits",
    add_node_to_diagram: "Adding component node to diagram",
    connect_nodes_in_diagram: "Connecting architecture nodes",
    validate_mermaid_syntax: "Validating Mermaid syntax compiler",
    enrich_node_details: "Enriching node metadata & documentation",
    ask_user_questions: "Preparing important architecture questions",
  };
  return toolLabels[name] || name.replace(/_/g, " ");
}

export const ThinkingAccordion = ({
  thinkingText,
  toolInvocations,
  isActive,
  completedDuration,
  waitingForUserResponse = false,
  startTime,
}: {
  thinkingText?: string;
  toolInvocations?: ChatToolPart[];
  isActive: boolean;
  completedDuration: number;
  waitingForUserResponse?: boolean;
  startTime?: number;
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isActive) return;
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  const liveSeconds = startTime
    ? Math.max(0, Math.floor((now - startTime) / 1000))
    : 0;

  const durationToShow = isActive ? liveSeconds : completedDuration;
  const formattedDuration =
    durationToShow < 10 ? `0${durationToShow}` : `${durationToShow}`;

  const text = waitingForUserResponse
    ? "Waiting for user response"
    : isActive
    ? `Thinking... ${liveSeconds > 0 ? `(${formattedDuration}s)` : ""}`
    : `Thought for ${formattedDuration}s`;

  const cleanThinking = cleanThinkingText(thinkingText || "");
  const hasThinkingContent = !!cleanThinking;
  const hasTools = !!(toolInvocations && toolInvocations.length > 0);

  if (!hasThinkingContent && !hasTools && !isActive) return null;

  return (
    <details
      className="group mr-auto w-full max-w-[95%] overflow-hidden bg-transparent text-xs text-muted-foreground transition-all border-none [&>summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 font-semibold select-none bg-transparent border-none w-fit focus:outline-none hover:text-foreground">
        <span
          className={
            isActive && !waitingForUserResponse ? "thinking-text font-bold" : "text-muted-foreground font-medium"
          }
        >
          {text}
        </span>
        {(hasThinkingContent || hasTools) && (
          <ChevronRight
            className={cn(
              "size-3.5 text-muted-foreground transition-all duration-200 shrink-0",
              "opacity-60 group-hover:opacity-100",
              "group-open:opacity-100 group-open:rotate-90",
            )}
          />
        )}
      </summary>

      <div className="space-y-2 bg-muted/60 border border-border-subtle rounded-md pl-3 pr-3 py-2 my-1">
        {/* Thinking CoT reasoning text */}
        {hasThinkingContent && (
          <div className="rounded border border-border-subtle bg-card p-2 text-[11px] prose prose-xs max-w-none dark:prose-invert text-foreground leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanThinking}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool Invocations Stream */}
        {hasTools && (
          <div className="space-y-1.5 pt-0.5">
            {toolInvocations.map((part, i) => (
              <ToolInvocationDisplay
                key={`${part.toolInvocation?.toolCallId || "tc"}-${i}`}
                invocation={part.toolInvocation}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
};

export function ToolInvocationDisplay({
  invocation,
}: {
  invocation: ChatToolInvocation | undefined;
}) {
  if (!invocation) return null;

  const toolName = invocation.toolName || "unknown";
  const state = invocation.state || "call";
  const result = invocation.result;

  const toolLabels: Record<string, string> = {
    inspect_architecture: "Inspecting architecture topology & documentation coverage",
    validate_documentation_completeness: "Checking documentation coverage for every component",
    read_markdown_lines: "Inspecting architecture document lines",
    replace_markdown_lines: "Applying line-by-line markdown edits",
    add_node_to_diagram: "Adding component node to diagram",
    connect_nodes_in_diagram: "Connecting architecture nodes",
    validate_mermaid_syntax: "Validating Mermaid syntax compiler",
    enrich_node_details: "Enriching node metadata & documentation",
    ask_user_questions: "Waiting for user response",
    list_connected_apps: "Checking connected integrations",
    list_repositories: "Listing repositories",
    get_dashboard_stats: "Fetching dashboard stats",
    create_task_plan: "Creating task plan",
    search_capabilities: "Searching capabilities",
  };

  const label = toolLabels[toolName] || toolName.replace(/_/g, " ");
  const isComplete = state === "result";
  const resultObj =
    result && typeof result === "object"
      ? (result as Record<string, unknown>)
      : null;
  const hasError = !!(
    isComplete &&
    resultObj &&
    (resultObj.success === false || !!resultObj.error)
  );

  return (
    <div className="flex items-center gap-2 pl-1 text-[11px]">
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-full shrink-0",
          isComplete && !hasError && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
          isComplete && hasError && "bg-red-500/20 text-red-600 dark:text-red-400",
          !isComplete && "bg-orange-500/20 text-orange-600 dark:text-orange-400",
        )}
      >
        {!isComplete ? (
          <Loader2 className="size-2.5 animate-spin" />
        ) : hasError ? (
          <X className="size-2.5" />
        ) : (
          <Check className="size-2.5" />
        )}
      </span>
      <span className="text-foreground font-mono text-[10px] truncate">
        {isComplete && !hasError ? "✓ " : ""}
        {label}
      </span>
      {isComplete && !!resultObj?.error && (
        <span className="text-red-500 text-[9px] truncate">
          — {String(resultObj.error)}
        </span>
      )}
    </div>
  );
}
