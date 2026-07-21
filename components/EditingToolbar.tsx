"use client";

import {
  MousePointer,
  Hand,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  HelpCircle,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";

interface EditingToolbarProps {
  activeTool: "select" | "move";
  onToolChange: (tool: "select" | "move") => void;
  onHelp?: () => void;
}

export default function EditingToolbar({
  activeTool,
  onToolChange,
  onHelp,
}: EditingToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 p-2 bg-card border border-border shadow-[4px_4px_0px_0px_var(--shadow-color)] select-none transition-colors">
      {/* Select Cursor */}
      <button
        onClick={() => onToolChange("select")}
        title="Select & Edit Mode"
        className={`p-2.5 transition-colors border ${
          activeTool === "select"
            ? "bg-primary text-primary-foreground border-border"
            : "bg-card text-foreground border-transparent hover:bg-muted"
        }`}
      >
        <MousePointer size={16} />
      </button>

      {/* Move Pan Tool */}
      <button
        onClick={() => onToolChange("move")}
        title="Pan Canvas Mode"
        className={`p-2.5 transition-colors border ${
          activeTool === "move"
            ? "bg-primary text-primary-foreground border-border"
            : "bg-card text-foreground border-transparent hover:bg-muted"
        }`}
      >
        <Hand size={16} />
      </button>

      <div className="w-full h-px bg-border-subtle my-0.5" />

      {/* Zoom In */}
      <button
        onClick={() => zoomIn()}
        title="Zoom In"
        className="p-2.5 bg-card text-foreground border border-transparent hover:bg-muted transition-colors"
      >
        <ZoomIn size={16} />
      </button>

      {/* Zoom Out */}
      <button
        onClick={() => zoomOut()}
        title="Zoom Out"
        className="p-2.5 bg-card text-foreground border border-transparent hover:bg-muted transition-colors"
      >
        <ZoomOut size={16} />
      </button>

      {/* Fit View */}
      <button
        onClick={() => fitView({ duration: 300 })}
        title="Fit View"
        className="p-2.5 bg-card text-foreground border border-transparent hover:bg-muted transition-colors"
      >
        <Maximize2 size={16} />
      </button>

      <div className="w-full h-px bg-border-subtle my-0.5" />

      {/* Help */}
      <button
        onClick={onHelp}
        title="Help & Shortcuts"
        className="p-2.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle size={16} />
      </button>
    </div>
  );
}
