"use client";

import { X, Layers, Code2, FileText, ChevronRight } from "lucide-react";

export type DetailSection = "overview" | "techStack" | "documentation";

interface NodeDetailSidebarProps {
  node: {
    id: string;
    label: string;
    category?: string;
    description?: string;
    techStack?: string[];
  };
  activeSection: DetailSection | null;
  onSelectSection: (section: DetailSection | null) => void;
  onClose: () => void;
}

export default function NodeDetailSidebar({
  node,
  activeSection,
  onSelectSection,
  onClose,
}: NodeDetailSidebarProps) {
  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 w-72 bg-card border border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] p-4 flex flex-col gap-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-3">
        <div className="overflow-hidden">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase">
              {node.id}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary text-primary-foreground">
              {node.category || "COMPONENT"}
            </span>
          </div>
          <h3 className="font-serif italic text-lg font-bold text-foreground truncate mt-0.5" title={node.label}>
            {node.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Details Section Button Menu */}
      <div className="flex flex-col gap-2.5">
        <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          Node Details & Actions
        </div>

        {/* Overview Button */}
        <button
          onClick={() => onSelectSection(activeSection === "overview" ? null : "overview")}
          className={`flex items-start justify-between p-3 border text-left transition-all group ${
            activeSection === "overview"
              ? "bg-primary text-primary-foreground border-border shadow-[2px_2px_0px_0px_var(--shadow-color)]"
              : "bg-muted/50 hover:bg-muted text-foreground border-border-subtle hover:border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <Layers size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide">Overview</div>
              <div className={`text-[11px] leading-tight mt-0.5 ${activeSection === "overview" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Summary & metadata
              </div>
            </div>
          </div>
          <ChevronRight size={14} className={`mt-1 transition-transform ${activeSection === "overview" ? "translate-x-1" : "group-hover:translate-x-1"}`} />
        </button>

        {/* Tech Stack Button */}
        <button
          onClick={() => onSelectSection(activeSection === "techStack" ? null : "techStack")}
          className={`flex items-start justify-between p-3 border text-left transition-all group ${
            activeSection === "techStack"
              ? "bg-primary text-primary-foreground border-border shadow-[2px_2px_0px_0px_var(--shadow-color)]"
              : "bg-muted/50 hover:bg-muted text-foreground border-border-subtle hover:border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <Code2 size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide">Tech Stack</div>
              <div className={`text-[11px] leading-tight mt-0.5 ${activeSection === "techStack" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Technologies & libraries
              </div>
            </div>
          </div>
          <ChevronRight size={14} className={`mt-1 transition-transform ${activeSection === "techStack" ? "translate-x-1" : "group-hover:translate-x-1"}`} />
        </button>

        {/* Documentation Button */}
        <button
          onClick={() => onSelectSection(activeSection === "documentation" ? null : "documentation")}
          className={`flex items-start justify-between p-3 border text-left transition-all group ${
            activeSection === "documentation"
              ? "bg-primary text-primary-foreground border-border shadow-[2px_2px_0px_0px_var(--shadow-color)]"
              : "bg-muted/50 hover:bg-muted text-foreground border-border-subtle hover:border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <FileText size={18} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wide">Documentation</div>
              <div className={`text-[11px] leading-tight mt-0.5 ${activeSection === "documentation" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Generated markdown docs
              </div>
            </div>
          </div>
          <ChevronRight size={14} className={`mt-1 transition-transform ${activeSection === "documentation" ? "translate-x-1" : "group-hover:translate-x-1"}`} />
        </button>
      </div>
    </div>
  );
}
