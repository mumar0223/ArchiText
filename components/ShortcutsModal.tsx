"use client";

import { X, Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({
  isOpen,
  onClose,
}: ShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: "Canvas Navigation & View",
      items: [
        {
          keys: ["Space", "Drag"],
          description: "Hold Spacebar and drag mouse to pan canvas",
        },
        {
          keys: ["Scroll Wheel"],
          description: "Zoom in or zoom out on architecture diagram",
        },
        {
          keys: ["Hand Tool"],
          description: "Switch to Pan mode from editing toolbar",
        },
        {
          keys: ["Maximize Icon"],
          description: "Fit all architecture nodes into view",
        },
      ],
    },
    {
      category: "Component & Diagram Selection",
      items: [
        {
          keys: ["Double Click"],
          description: "Inline edit any component or group label",
        },
        {
          keys: ["Single Click"],
          description:
            "Inspect component (Overview, Tech Stack & Documentation)",
        },
        {
          keys: ["Shift", "Click"],
          description: "Multi-select nodes to target in AI prompt",
        },
        {
          keys: ["Drag Box"],
          description: "Marquee box select multiple components",
        },
      ],
    },
    {
      category: "AI & Blueprint Controls",
      items: [
        {
          keys: ["Target Button"],
          description: "Focus AI changes on selected components",
        },
        {
          keys: ["Export Blueprint"],
          description: "Export architecture as PNG, SVG, or Markdown",
        },
        {
          keys: ["Agent Process Log"],
          description: "Switch tabs between AI Chat Log and Doc Code editor",
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-[520px] max-w-[92vw] bg-card border border-border shadow-[6px_6px_0px_0px_var(--shadow-color)] p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 transition-colors max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-orange-500" />
            <h4 className="font-serif italic text-lg font-bold text-foreground">
              Keyboard & Canvas Shortcuts
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Categories */}
        <div className="flex flex-col gap-4 text-xs font-sans">
          {shortcuts.map((section) => (
            <div key={section.category} className="flex flex-col gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground border-b border-border-subtle/60 pb-1">
                {section.category}
              </span>
              <div className="grid grid-cols-1 gap-2">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded bg-panel-bg border border-border-subtle/50 hover:border-border-subtle transition-colors"
                  >
                    <span className="text-foreground font-medium">
                      {item.description}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 text-[10px] font-mono font-bold bg-muted text-foreground border border-border-subtle shadow-xs rounded"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border-subtle shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-primary-foreground border border-border text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)] cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
