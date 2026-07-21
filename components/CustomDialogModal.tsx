"use client";

import { useState, useEffect, useRef } from "react";
import { X, Plus, HelpCircle } from "lucide-react";

interface CustomDialogModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  type: "prompt" | "alert";
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (val?: string) => void;
  onClose: () => void;
}

export default function CustomDialogModal({
  isOpen,
  title,
  description,
  type,
  placeholder = "Enter value...",
  defaultValue = "",
  onConfirm,
  onClose,
}: CustomDialogModalProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(defaultValue);
    if (isOpen && type === "prompt") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue, type]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (type === "prompt") {
      if (!inputValue.trim()) return;
      onConfirm(inputValue.trim());
    } else {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-[420px] max-w-[90vw] bg-card border border-border shadow-[6px_6px_0px_0px_var(--shadow-color)] p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-150 transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div className="flex items-center gap-2">
            {type === "prompt" ? (
              <Plus size={18} className="text-orange-500" />
            ) : (
              <HelpCircle size={18} className="text-blue-500 dark:text-blue-400" />
            )}
            <h4 className="font-serif italic text-lg font-bold text-foreground">
              {title}
            </h4>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        {description && (
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            {description}
          </p>
        )}

        {type === "prompt" && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder}
              className="w-full p-2.5 bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none font-mono text-xs placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-muted border border-border-subtle text-foreground text-xs font-bold uppercase tracking-wider hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider disabled:opacity-40 hover:opacity-80 transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)]"
              >
                Add Node
              </button>
            </div>
          </form>
        )}

        {type === "alert" && (
          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)]"
            >
              Got it
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
