"use client";

import { useState, useEffect } from "react";
import { X, Layers, Code2, FileText, Plus, Check, Pencil, Eye, Code, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DetailSection } from "./NodeDetailSidebar";

interface FloatingCenterModalProps {
  node: {
    id: string;
    label: string;
    category?: string;
    description?: string;
    techStack?: string[];
    documentation?: string;
    displayDocumentation?: string;
  };
  activeSection: DetailSection;
  onUpdateNode: (
    updatedData: Partial<{
      label: string;
      category: string;
      description: string;
      techStack: string[];
      documentation: string;
    }>,
  ) => void;
  onClose: () => void;
}

export default function FloatingCenterModal({
  node,
  activeSection,
  onUpdateNode,
  onClose,
}: FloatingCenterModalProps) {
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [tempDoc, setTempDoc] = useState(node.documentation || "");
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [newTechTag, setNewTechTag] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const copyReadyDocumentation = node.displayDocumentation || node.documentation || "";

  useEffect(() => {
    if (!isEditingDoc) {
      setTempDoc(node.documentation || "");
    }
  }, [node.documentation, isEditingDoc]);

  const handleSaveDoc = () => {
    onUpdateNode({ documentation: tempDoc });
    setIsEditingDoc(false);
  };

  const handleAddTechTag = () => {
    if (!newTechTag.trim()) return;
    const updated = [...(node.techStack || []), newTechTag.trim()];
    onUpdateNode({ techStack: updated });
    setNewTechTag("");
  };

  const handleRemoveTechTag = (tagToRemove: string) => {
    const updated = (node.techStack || []).filter((t) => t !== tagToRemove);
    onUpdateNode({ techStack: updated });
  };

  return (
    <div className="absolute top-4 bottom-[126px] left-[360px] right-[320px] max-md:left-4 max-md:right-4 z-40 bg-card border border-border shadow-[6px_6px_0px_0px_var(--shadow-color)] p-6 overflow-y-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="flex items-center gap-3">
          {activeSection === "overview" && (
            <Layers className="text-orange-500" size={20} />
          )}
          {activeSection === "techStack" && (
            <Code2 className="text-orange-500" size={20} />
          )}
          {activeSection === "documentation" && (
            <FileText className="text-orange-500" size={20} />
          )}
          <div>
            <h4 className="font-serif italic text-xl font-bold text-foreground">
              {node.label} — {activeSection.toUpperCase()}
            </h4>
            <p className="text-[11px] text-muted-foreground font-mono">
              Node ID: {node.id} | Category: {node.category || "COMPONENT"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content based on Active Section */}
      {activeSection === "overview" && (
        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Component Name / Label
            </label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => onUpdateNode({ label: e.target.value })}
              className="w-full p-2 bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none font-bold text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Category
            </label>
            <input
              type="text"
              value={node.category || ""}
              onChange={(e) => onUpdateNode({ category: e.target.value })}
              placeholder="e.g. DATABASE, BACKEND API, FRONTEND"
              className="w-full p-2 bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none font-mono uppercase text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Description Summary
            </label>
            <textarea
              value={node.description || ""}
              onChange={(e) => onUpdateNode({ description: e.target.value })}
              rows={3}
              className="w-full p-2 bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none leading-relaxed resize-none"
            />
          </div>
        </div>
      )}

      {activeSection === "techStack" && (
        <div className="flex flex-col gap-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Technologies & Libraries
            </label>
            <div className="flex flex-wrap gap-2 mb-4">
              {(node.techStack || []).map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 bg-primary text-primary-foreground font-mono text-[11px] flex items-center gap-2 shadow-sm"
                >
                  {tech}
                  <button
                    onClick={() => handleRemoveTechTag(tech)}
                    className="hover:text-orange-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
              {(!node.techStack || node.techStack.length === 0) && (
                <span className="text-muted-foreground italic">
                  No tech stack specified yet.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTechTag}
                onChange={(e) => setNewTechTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTechTag()}
                placeholder="Add technology (e.g. Redis, Express)..."
                className="flex-1 p-2 bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none font-mono text-xs"
              />
              <button
                onClick={handleAddTechTag}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs uppercase font-bold tracking-widest hover:opacity-80 transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === "documentation" && (
        <div className="flex-1 flex flex-col gap-3 text-xs min-h-0">
          <div className="flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Markdown Documentation
              </span>

              {/* View Mode Switcher (PREVIEW vs RAW) */}
              {!isEditingDoc && (
                <div className="flex items-center border border-border-subtle bg-muted p-0.5">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                      viewMode === "preview"
                        ? "bg-card text-foreground shadow-xs border border-border-subtle"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye size={10} /> Preview
                  </button>
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                      viewMode === "raw"
                        ? "bg-card text-foreground shadow-xs border border-border-subtle"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code size={10} /> Raw
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {/* Copy Documentation Button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(isEditingDoc ? tempDoc : copyReadyDocumentation);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                title={isCopied ? "Copied to clipboard!" : "Copy Documentation"}
                className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center"
              >
                {isCopied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              </button>

              {/* Edit Mode Buttons */}
              {isEditingDoc ? (
                <>
                  {/* Tick / Confirm Button - Updates Node & Keeps Modal Open */}
                  <button
                    onClick={() => {
                      onUpdateNode({ documentation: tempDoc });
                      setIsEditingDoc(false);
                    }}
                    title="Apply & Save Changes"
                    className="p-1.5 bg-green-600 text-white hover:bg-green-700 transition-colors border border-green-700 shadow-xs flex items-center justify-center"
                  >
                    <Check size={13} />
                  </button>

                  {/* Cancel / Revert Button */}
                  <button
                    onClick={() => {
                      setTempDoc(node.documentation || "");
                      setIsEditingDoc(false);
                    }}
                    title="Cancel & Revert Changes"
                    className="p-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors border border-red-700 shadow-xs flex items-center justify-center"
                  >
                    <X size={13} />
                  </button>
                </>
              ) : (
                /* Enter Edit Mode Button */
                <button
                  onClick={() => {
                    setTempDoc(node.documentation || "");
                    setIsEditingDoc(true);
                  }}
                  title="Edit Documentation"
                  className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>

          {isEditingDoc ? (
            <textarea
              value={tempDoc}
              onChange={(e) => setTempDoc(e.target.value)}
              placeholder="Write markdown documentation for this component..."
              className="flex-1 w-full p-4 font-mono text-xs bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none resize-none leading-relaxed min-h-[220px]"
            />
          ) : viewMode === "raw" ? (
            <pre className="flex-1 overflow-y-auto p-4 bg-panel-bg border border-border-subtle font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap selection:bg-primary selection:text-primary-foreground">
              {copyReadyDocumentation || "*No documentation available for this component.*"}
            </pre>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 bg-panel-bg border border-border-subtle prose prose-sm max-w-none dark:prose-invert text-foreground leading-relaxed font-sans">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {copyReadyDocumentation ||
                  "*No documentation available for this component.*"}
              </ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
