"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Layers, AlertTriangle, RefreshCw, Home, Terminal } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("Application error boundary caught error:", error);
  }, [error]);

  return (
    <div className="flex flex-col h-screen bg-canvas-bg text-foreground font-sans selection:bg-primary selection:text-primary-foreground transition-colors overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border bg-panel-header px-6 flex items-center justify-between shrink-0 select-none z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_0px_var(--shadow-color)]">
            <Layers size={18} />
          </div>
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif italic font-extrabold text-xl tracking-tight text-foreground">
              ArchiText AI
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xs">
              SYSTEM FAULT
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Canvas Body */}
      <main className="flex-1 relative flex items-center justify-center p-6 bg-[radial-gradient(var(--dot-color)_1px,transparent_1px)] [background-size:24px_24px]">
        <div className="w-[560px] max-w-full bg-card border border-border p-8 shadow-[8px_8px_0px_0px_var(--shadow-color)] flex flex-col gap-6 animate-in zoom-in-95 duration-200">
          {/* Node Badge */}
          <div className="flex items-center justify-between border-b border-border-subtle pb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-destructive/10 text-destructive border border-destructive/30 font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle size={14} />
              SYSTEM EXECUTION FAULT
            </div>
            {error.digest && (
              <span className="font-mono text-[10px] text-muted-foreground font-bold">
                DIGEST: {error.digest}
              </span>
            )}
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-2">
            <h1 className="font-serif italic text-3xl font-bold tracking-tight text-foreground">
              Architecture Runtime Error
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              An unhandled runtime error occurred while processing the system diagram state or rendering components.
            </p>
          </div>

          {/* Error Message & Details */}
          <div className="bg-panel-bg border border-border-subtle p-4 font-mono text-[11px] leading-relaxed text-foreground flex flex-col gap-2 shadow-inner">
            <div className="flex items-center gap-2 text-muted-foreground pb-2 border-b border-border-subtle/50">
              <Terminal size={13} className="text-destructive" />
              <span className="font-bold">Error Stack Trace Log</span>
            </div>
            <p className="text-destructive font-bold break-words">
              {error.message || "An unexpected error occurred in the workspace."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                } else {
                  reset();
                }
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground border border-border text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] cursor-pointer"
            >
              <RefreshCw size={15} />
              Reconnect System (Try Again)
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-card text-foreground border border-border text-xs font-bold uppercase tracking-wider hover:bg-muted transition-all shadow-[4px_4px_0px_0px_var(--shadow-color)] cursor-pointer"
            >
              <Home size={15} />
              Workspace Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
