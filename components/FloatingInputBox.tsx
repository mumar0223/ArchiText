"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { Send, Sparkles, X } from "lucide-react";

interface FloatingInputBoxProps {
  selectedNodeLabel?: string;
  selectedNodeLabels?: string[];
  dismissedNodeLabels?: string[];
  onClearSelectedNode?: () => void;
  onRemoveNodeLabel?: (label: string) => void;
  multiSelectCount?: number;
  showMultiTargetButton?: boolean;
  onTargetMultiSelect?: () => void;
  isCanvasMoving?: boolean;
  onSubmit: (prompt: string) => void;
  isLoading?: boolean;
}

export default function FloatingInputBox({
  selectedNodeLabel,
  selectedNodeLabels = [],
  dismissedNodeLabels = [],
  onClearSelectedNode,
  onRemoveNodeLabel,
  multiSelectCount,
  showMultiTargetButton = true,
  onTargetMultiSelect,
  isCanvasMoving,
  onSubmit,
  isLoading,
}: FloatingInputBoxProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const maxHeight = 160;
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSubmit(input);
    setInput("");
  };

  const effectiveSingleLabel =
    selectedNodeLabel && !dismissedNodeLabels.includes(selectedNodeLabel)
      ? selectedNodeLabel
      : undefined;

  const activeLabels =
    selectedNodeLabels.length > 0
      ? selectedNodeLabels
      : effectiveSingleLabel
        ? [effectiveSingleLabel]
        : [];

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-[600px] max-w-[92vw] bg-card border border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] p-3 flex flex-col gap-2 transition-colors">
      {/* Floating Multi-Select Target Button relative to top edge */}
      {showMultiTargetButton &&
        multiSelectCount &&
        multiSelectCount >= 2 &&
        onTargetMultiSelect && (
          <div
            className={`absolute -top-11 left-1/2 -translate-x-1/2 transition-all duration-200 ${
              isCanvasMoving
                ? "opacity-0 pointer-events-none translate-y-2"
                : "opacity-100 translate-y-0"
            }`}
          >
            <button
              onClick={onTargetMultiSelect}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-mono font-bold uppercase tracking-wider shadow-[4px_4px_0px_0px_var(--shadow-color)] border border-border hover:bg-orange-500 hover:text-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={14} className="text-orange-400" />+ Target{" "}
              {multiSelectCount} Selected Components
            </button>
          </div>
        )}
      {/* Selected Node Context Tags */}
      {activeLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeLabels.map((lbl) => (
            <span
              key={lbl}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary text-primary-foreground text-[11px] font-bold font-mono"
            >
              <Sparkles size={12} className="text-orange-400" />
              Target: {lbl}
              <button
                onClick={() => onRemoveNodeLabel?.(lbl)}
                className="ml-1 hover:text-orange-400 transition-colors"
                title={`Remove ${lbl}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            selectedNodeLabel
              ? `Describe changes for ${selectedNodeLabel}...`
              : "Describe what to build or change in architecture..."
          }
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-xs font-mono leading-normal py-2 px-2 text-foreground placeholder:text-muted-foreground overflow-y-auto max-h-[160px]"
          style={{ minHeight: "36px" }}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="p-2 bg-primary text-primary-foreground disabled:opacity-40 hover:opacity-80 transition-colors shrink-0 shadow-[2px_2px_0px_0px_var(--shadow-color)] flex items-center justify-center h-9 w-9 self-end"
          title="Send Prompt"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
