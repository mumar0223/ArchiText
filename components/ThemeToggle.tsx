"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 p-2 border border-transparent rounded bg-transparent" />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getIcon = () => {
    if (theme === "dark") return <Moon size={16} className="text-amber-400" />;
    if (theme === "light") return <Sun size={16} className="text-orange-500" />;
    return <Monitor size={16} className="text-foreground" />;
  };

  return (
    <button
      onClick={cycleTheme}
      title={`Current Theme: ${theme || "system"}. Click to cycle (Light -> Dark -> System)`}
      className="p-2.5 bg-card text-foreground border border-border hover:bg-muted transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)] flex items-center justify-center"
      aria-label="Toggle theme"
    >
      {getIcon()}
    </button>
  );
}
