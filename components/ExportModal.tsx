"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  FolderArchive,
  FileText,
  Download,
  Folder,
  Check,
  Code,
  Eye,
  FileCode,
  Sparkles,
  Info,
  Copy,
  Pencil,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  buildExportFileTree,
  downloadSingleMarkdown,
  downloadExportZip,
  ExportFileItem,
} from "@/lib/markdownExport";

interface ExportModalProps {
  isOpen: boolean;
  document: string;
  onDocumentChange?: (doc: string) => void;
  onClose: () => void;
}

type TabType = "zip" | "explorer";

export default function ExportModal({
  isOpen,
  document,
  onDocumentChange,
  onClose,
}: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("zip");
  const [selectedFilePath, setSelectedFilePath] = useState<string>("");
  const [viewMode, setViewMode] = useState<"preview" | "raw">("preview");
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [zipSuccess, setZipSuccess] = useState(false);
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(
    new Set(),
  );

  // Generate file tree from document
  const files = useMemo(() => {
    if (!document) return [];
    return buildExportFileTree(document);
  }, [document]);

  // Set default selected file for explorer
  const activeFile = useMemo(() => {
    if (files.length === 0) return null;
    const found = files.find((f) => f.path === selectedFilePath);
    return found || files[0];
  }, [files, selectedFilePath]);

  useEffect(() => {
    if (!isEditing && activeFile) {
      setTempContent(activeFile.content);
    }
  }, [activeFile, isEditing]);

  if (!isOpen) return null;

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      await downloadExportZip(files);
      setZipSuccess(true);
      setTimeout(() => setZipSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to generate zip:", err);
    } finally {
      setIsZipping(false);
    }
  };

  const handleDownloadSingleFile = (file: ExportFileItem) => {
    downloadSingleMarkdown(file.filename, file.content);
    setDownloadedFiles((prev) => new Set(prev).add(file.path));
  };

  // Group files by folder for tree view
  const folderTree = files.reduce(
    (acc, file) => {
      const folder = file.folder || "Root";
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(file);
      return acc;
    },
    {} as Record<string, ExportFileItem[]>,
  );

  const totalFolders = Object.keys(folderTree).length;
  const totalFiles = files.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 p-4">
      <div className="w-[90vw] min-w-[720px] max-w-[90vw] h-[90vh] max-h-[850px] min-h-[550px] bg-card border border-border shadow-[8px_8px_0px_0px_var(--shadow-color)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 transition-colors">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-panel-header shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary border border-primary/20">
              <FolderArchive size={20} />
            </div>
            <div>
              <h3 className="font-serif italic text-xl font-bold text-foreground flex items-center gap-2">
                Export & AI Knowledge Center
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 font-semibold">
                  Agent Ready
                </span>
              </h3>
              <p className="text-xs text-muted-foreground font-sans">
                Package architecture into organized Markdown folders & files
                optimized for AI coding assistants.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border-subtle"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body with Sidebar + View Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Menu */}
          <div className="w-64 bg-panel-bg border-r border-border-subtle p-3 flex flex-col gap-1 shrink-0 select-none">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Export Settings & Views
            </div>

            <button
              onClick={() => setActiveTab("zip")}
              className={`flex items-start gap-3 p-3 text-left transition-colors border ${
                activeTab === "zip"
                  ? "bg-card border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FolderArchive
                size={18}
                className={
                  activeTab === "zip"
                    ? "text-orange-500 shrink-0 mt-0.5"
                    : "shrink-0 mt-0.5"
                }
              />
              <div>
                <div className="text-xs font-bold font-sans">
                  AI Knowledge Pack (.zip)
                </div>
                <div className="text-[11px] font-normal opacity-80 leading-tight mt-0.5">
                  Download structured zip of all folders & files
                </div>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("explorer")}
              className={`flex items-start gap-3 p-3 text-left transition-colors border ${
                activeTab === "explorer"
                  ? "bg-card border-border shadow-[2px_2px_0px_0px_var(--shadow-color)] text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <FileText
                size={18}
                className={
                  activeTab === "explorer"
                    ? "text-orange-500 shrink-0 mt-0.5"
                    : "shrink-0 mt-0.5"
                }
              />
              <div>
                <div className="text-xs font-bold font-sans">
                  Markdown Explorer
                </div>
                <div className="text-[11px] font-normal opacity-80 leading-tight mt-0.5">
                  Inspect & download individual `.md` files
                </div>
              </div>
            </button>

            <div className="mt-auto p-3 bg-card border border-border-subtle text-[11px] text-muted-foreground leading-relaxed flex flex-col gap-2">
              <div className="flex items-center gap-1.5 font-bold text-foreground">
                <Sparkles size={14} className="text-orange-500" />
                AI Agent Context
              </div>
              <div>
                Includes relative path indexing and merged component metadata so
                AI agents understand your full system architecture instantly.
              </div>
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 bg-card overflow-y-auto flex flex-col">
            {activeTab === "zip" ? (
              /* TAB 1: AI Knowledge Pack ZIP View */
              <div className="p-6 flex flex-col gap-6 flex-1">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-panel-bg border border-border-subtle flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Total Markdown Files
                    </span>
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {totalFiles}
                    </span>
                  </div>

                  <div className="p-4 bg-panel-bg border border-border-subtle flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Group Directories
                    </span>
                    <span className="text-2xl font-bold font-mono text-foreground">
                      {totalFolders}
                    </span>
                  </div>

                  <div className="p-4 bg-panel-bg border border-border-subtle flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Primary AI Context
                    </span>
                    <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 truncate mt-1">
                      PROJECT_CONTEXT.md
                    </span>
                  </div>
                </div>

                {/* Information Banner */}
                <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100 text-xs flex gap-3 items-start">
                  <Info
                    size={18}
                    className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400"
                  />
                  <div className="leading-relaxed">
                    <strong>Structure Guarantee:</strong> Each subgraph in your
                    architecture diagram is converted into its own folder (e.g.{" "}
                    <code className="font-mono text-[11px] bg-blue-100 dark:bg-blue-900/80 text-blue-950 dark:text-blue-100 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 font-bold">
                      Frontend/
                    </code>
                    ,{" "}
                    <code className="font-mono text-[11px] bg-blue-100 dark:bg-blue-900/80 text-blue-950 dark:text-blue-100 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 font-bold">
                      Backend/
                    </code>
                    ). Node details are saved as individual Markdown files, and
                    the main{" "}
                    <code className="font-mono text-[11px] bg-blue-100 dark:bg-blue-900/80 text-blue-950 dark:text-blue-100 border border-blue-300 dark:border-blue-700 px-1.5 py-0.5 font-bold">
                      PROJECT_CONTEXT.md
                    </code>{" "}
                    provides the master topology summary for AI agents.
                  </div>
                </div>

                {/* Directory & File Tree Preview */}
                <div className="flex-1 flex flex-col border border-border-subtle bg-panel-bg overflow-hidden">
                  <div className="px-4 py-2 border-b border-border-subtle text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-panel-header flex items-center justify-between">
                    <span>Generated ZIP Directory Preview</span>
                    <span className="font-mono text-[10px]">
                      architecture-ai-knowledge.zip
                    </span>
                  </div>

                  <div className="p-4 overflow-y-auto font-mono text-xs flex flex-col gap-3">
                    {Object.entries(folderTree).map(([folder, folderFiles]) => (
                      <div key={folder} className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-foreground font-bold">
                          <Folder size={14} className="text-orange-500" />
                          <span>{folder === "Root" ? "/" : `${folder}/`}</span>
                        </div>
                        <div className="pl-6 flex flex-col gap-1 border-l-2 border-border-subtle ml-1.5">
                          {folderFiles.map((file) => (
                            <div
                              key={file.path}
                              className="flex items-center justify-between text-muted-foreground py-0.5 hover:text-foreground transition-colors"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileCode
                                  size={13}
                                  className="shrink-0 text-muted-foreground"
                                />
                                <span
                                  className={
                                    file.isIndex
                                      ? "font-bold text-orange-600 dark:text-orange-400"
                                      : "text-foreground font-medium"
                                  }
                                >
                                  {file.filename}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {file.isIndex
                                  ? "Root Agent Overview"
                                  : `${file.title}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom CTA Button */}
                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <span className="text-xs text-muted-foreground font-sans">
                    Ready to download all {totalFiles} markdown files in a
                    single .zip
                  </span>

                  <button
                    onClick={handleDownloadZip}
                    disabled={isZipping}
                    className="px-6 py-3 bg-primary text-primary-foreground text-xs uppercase tracking-wider font-bold hover:opacity-80 transition-colors shadow-[4px_4px_0px_0px_var(--shadow-color)] border border-border flex items-center gap-2 disabled:opacity-50"
                  >
                    {zipSuccess ? (
                      <>
                        <Check size={16} className="text-green-400" />
                        Zip Downloaded!
                      </>
                    ) : isZipping ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Generating Archive...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download AI Knowledge Pack (.zip)
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* TAB 2: Markdown Explorer View */
              <div className="flex flex-1 overflow-hidden">
                {/* Internal Left Sub-sidebar: File Tree Selector */}
                <div className="w-64 border-r border-border-subtle bg-panel-bg flex flex-col shrink-0 overflow-y-auto select-none">
                  <div className="p-3 border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Select File to Inspect
                  </div>

                  <div className="p-2 flex flex-col gap-3">
                    {Object.entries(folderTree).map(([folder, folderFiles]) => (
                      <div key={folder} className="flex flex-col gap-1">
                        <div className="px-2 py-1 text-[11px] font-bold text-foreground flex items-center gap-1.5">
                          <Folder size={13} className="text-orange-500" />
                          {folder === "Root" ? "Root Directory" : `${folder}`}
                        </div>

                        {folderFiles.map((file) => {
                          const isSelected = activeFile?.path === file.path;
                          const isDownloaded = downloadedFiles.has(file.path);

                          return (
                            <button
                              key={file.path}
                              onClick={() => setSelectedFilePath(file.path)}
                              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 border transition-colors ${
                                isSelected
                                  ? "bg-card border-border font-bold text-foreground shadow-[2px_2px_0px_0px_var(--shadow-color)]"
                                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileText
                                  size={13}
                                  className={
                                    file.isIndex
                                      ? "text-orange-500 shrink-0"
                                      : "shrink-0"
                                  }
                                />
                                <span className="truncate">
                                  {file.filename}
                                </span>
                              </div>

                              {isDownloaded && (
                                <span title="Downloaded">
                                  <Check
                                    size={12}
                                    className="text-green-500 shrink-0"
                                  />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Internal Right Main Preview Area */}
                {activeFile ? (
                  <div className="flex-1 flex flex-col overflow-hidden bg-card">
                    {/* Active File Header */}
                    <div className="px-6 py-3 border-b border-border-subtle bg-panel-header flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-3">
                        <FileText size={18} className="text-orange-500" />
                        <div>
                          <h4 className="font-mono font-bold text-sm text-foreground flex items-center gap-2">
                            {activeFile.filename}
                            {activeFile.isIndex && (
                              <span className="text-[9px] uppercase px-1.5 py-0.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 font-semibold font-sans">
                                Root Index
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Path: ./{activeFile.path}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Copy Markdown Button */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(
                              isEditing ? tempContent : activeFile.content,
                            );
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                          }}
                          title={isCopied ? "Copied to clipboard!" : "Copy Markdown"}
                          className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center"
                        >
                          {isCopied ? (
                            <Check size={13} className="text-green-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>

                        {/* View Mode Switcher */}
                        {!isEditing && (
                          <div className="flex items-center border border-border-subtle bg-panel-bg p-0.5">
                            <button
                              onClick={() => setViewMode("preview")}
                              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                                viewMode === "preview"
                                  ? "bg-card text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Eye size={12} />
                              Preview
                            </button>
                            <button
                              onClick={() => setViewMode("raw")}
                              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors ${
                                viewMode === "raw"
                                  ? "bg-card text-foreground shadow-xs"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Code size={12} />
                              Raw
                            </button>
                          </div>
                        )}

                        {/* Edit Mode Buttons */}
                        {isEditing ? (
                          <div className="flex items-center gap-1.5">
                            {/* Tick / Confirm Button */}
                            <button
                              onClick={() => {
                                if (activeFile.isIndex && onDocumentChange) {
                                  onDocumentChange(tempContent);
                                }
                                setIsEditing(false);
                              }}
                              title="Apply & Save Changes"
                              className="p-1.5 bg-green-600 text-white hover:bg-green-700 transition-colors border border-green-700 shadow-xs flex items-center justify-center"
                            >
                              <Check size={13} />
                            </button>

                            {/* Cancel / Revert Button */}
                            <button
                              onClick={() => {
                                setTempContent(activeFile.content);
                                setIsEditing(false);
                              }}
                              title="Cancel & Revert Changes"
                              className="p-1.5 bg-red-600 text-white hover:bg-red-700 transition-colors border border-red-700 shadow-xs flex items-center justify-center"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          /* Enter Edit Mode Button */
                          <button
                            onClick={() => {
                              setTempContent(activeFile.content);
                              setIsEditing(true);
                            }}
                            title="Edit File Markdown"
                            className="p-1.5 bg-card text-foreground border border-border-subtle hover:bg-muted hover:border-border transition-colors flex items-center justify-center"
                          >
                            <Pencil size={13} />
                          </button>
                        )}

                        {/* Individual Download Button */}
                        <button
                          onClick={() => handleDownloadSingleFile(activeFile)}
                          className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-80 transition-colors shadow-[2px_2px_0px_0px_var(--shadow-color)] flex items-center gap-1.5"
                        >
                          <Download size={13} />
                          Download File
                        </button>
                      </div>
                    </div>

                    {/* Preview Content Window */}
                    <div className="flex-1 p-6 overflow-y-auto bg-card flex flex-col min-h-0">
                      {isEditing ? (
                        <textarea
                          value={tempContent}
                          onChange={(e) => setTempContent(e.target.value)}
                          className="flex-1 w-full h-full p-4 font-mono text-xs bg-panel-bg text-foreground border border-border-subtle focus:border-border outline-none resize-none leading-relaxed min-h-[300px]"
                          spellCheck={false}
                        />
                      ) : viewMode === "preview" ? (
                        <div className="prose dark:prose-invert max-w-none text-xs font-sans leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => {
                                const linkedPath = href
                                  ? decodeURIComponent(href).replace(/^\.\//, "")
                                  : "";
                                const linkedFile = files.find(
                                  (file) => file.path === linkedPath,
                                );

                                if (linkedFile) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFilePath(linkedFile.path);
                                        setActiveTab("explorer");
                                      }}
                                      className="font-semibold text-orange-600 underline underline-offset-2 dark:text-orange-400"
                                      title={`Open ${linkedFile.path}`}
                                    >
                                      {children}
                                    </button>
                                  );
                                }

                                return <a href={href}>{children}</a>;
                              },
                            }}
                          >
                            {activeFile.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <pre className="font-mono text-xs p-4 bg-panel-bg border border-border-subtle text-foreground whitespace-pre-wrap leading-relaxed">
                          {activeFile.content}
                        </pre>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
                    Select a file from the left menu to preview.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
