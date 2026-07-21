"use client";

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BaseEdge,
  Edge,
  EdgeProps,
  getSmoothStepPath,
  Node,
  NodeChange,
  Handle,
  Position,
  MarkerType,
  OnSelectionChangeParams,
  ReactFlowInstance,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  parseMermaid,
  generateMermaid,
  isValidMermaidDocument,
} from "@/lib/mermaid";
import { getLayoutedElements, getVisualNodeSize } from "@/lib/layout";
import { Database, Server, Box, AlertTriangle } from "lucide-react";

function getNodeColorStyle(
  id: string,
  label: string = "",
  category: string = "",
) {
  if (category === "SYNTAX ERROR") {
    return {
      borderColor: "#ef4444",
      backgroundColor: "color-mix(in srgb, #ef4444 12%, var(--card))",
      badgeBg: "#dc2626",
      badgeText: "#ffffff",
      tagBg: "color-mix(in srgb, #ef4444 20%, var(--card))",
      tagBorder: "#ef4444",
      tagText: "#ef4444",
      dotBg: "#ef4444",
    };
  }
  const str = id + ":" + category;
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  const hue = (Math.abs(hash) * 137) % 360;
  return {
    borderColor: `hsl(${hue}, 65%, 45%)`,
    backgroundColor: `color-mix(in srgb, hsl(${hue}, 70%, 50%) 10%, var(--card))`,
    badgeBg: `hsl(${hue}, 70%, 40%)`,
    badgeText: "#ffffff",
    tagBg: `color-mix(in srgb, hsl(${hue}, 70%, 50%) 16%, var(--card))`,
    tagBorder: `color-mix(in srgb, hsl(${hue}, 65%, 45%) 40%, var(--border-subtle))`,
    tagText: `color-mix(in srgb, hsl(${hue}, 80%, 45%) 80%, var(--foreground))`,
    dotBg: `hsl(${hue}, 75%, 50%)`,
  };
}

function topologyFingerprint(parsed: any): string {
  const nodes = parsed.nodes
    .map(
      (node: any) =>
        `${node.id}:${node.type || "node"}:${node.parent || "root"}`,
    )
    .sort();
  const edges = parsed.edges
    .map((edge: any) => `${edge.source}>${edge.target}:${edge.label || ""}`)
    .sort();
  return `${parsed.direction || "LR"}|${nodes.join("|")}|${edges.join("|")}`;
}

function applyDirectionalHandles(nodes: Node[], edges: Edge[]): Edge[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const absolutePosition = (node: Node): { x: number; y: number } => {
    const position = node.position || { x: 0, y: 0 };
    if (!node.parentId) return position;
    const parent = nodeById.get(node.parentId);
    if (!parent) return position;
    const parentPosition = absolutePosition(parent);
    return {
      x: parentPosition.x + position.x,
      y: parentPosition.y + position.y,
    };
  };

  return edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return edge;
    const sourcePosition = absolutePosition(source);
    const targetPosition = absolutePosition(target);
    const routesRightToLeft = sourcePosition.x > targetPosition.x;

    return {
      ...edge,
      sourceHandle: routesRightToLeft ? "source-left" : undefined,
      targetHandle: routesRightToLeft ? "target-right" : undefined,
    };
  });
}

function CustomNode({ id, data, selected }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data?.label || id);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLabel(data?.label || id);
  }, [data?.label, id]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  const onBlur = () => {
    setIsEditing(false);
    if (label !== data.label) {
      data.onLabelChange(id, label);
    }
  };

  if (data.isSkeleton) {
    return (
      <div className="bg-card border border-border-subtle p-3.5 flex flex-col justify-between shadow-[4px_4px_0px_0px_var(--shadow-color)] min-w-[180px] min-h-[72px] relative animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="h-3 w-16 bg-muted" />
          <div className="w-2 h-2 rounded-full bg-orange-400 animate-ping" />
        </div>
        <div className="h-4 w-28 bg-muted mb-2" />
        <div className="flex gap-1">
          <div className="h-3 w-10 bg-muted" />
          <div className="h-3 w-12 bg-muted" />
        </div>
      </div>
    );
  }

  const isError = data.category === "SYNTAX ERROR";
  const isDb = data.category === "DATABASE";
  const isApi = data.category === "BACKEND API";
  const colors = getNodeColorStyle(id, data.label || id, data.category);

  const glowShadow = selected
    ? `0 0 16px 2px ${colors.borderColor}, 4px 4px 0px 0px var(--shadow-color)`
    : `4px 4px 0px 0px var(--shadow-color)`;

  return (
    <div
      style={{
        borderColor: colors.borderColor,
        backgroundColor: colors.backgroundColor,
        boxShadow: glowShadow,
      }}
      className={`border p-3.5 flex flex-col justify-between w-[270px] min-h-[112px] relative group transition-all duration-200 ${
        selected ? "border-2" : "border"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="w-2.5 h-2.5 rounded-none bg-primary border-none -ml-1.5 opacity-0 pointer-events-none transition-opacity"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        isConnectable={false}
        className="w-2.5 h-2.5 rounded-none bg-primary border-none -mr-1.5 opacity-0 pointer-events-none"
      />

      {/* Header / Category */}
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-1.5">
          {isError ? (
            <AlertTriangle size={13} style={{ color: colors.borderColor }} />
          ) : isDb ? (
            <Database size={13} style={{ color: colors.borderColor }} />
          ) : isApi ? (
            <Server size={13} style={{ color: colors.borderColor }} />
          ) : (
            <Box size={13} style={{ color: colors.borderColor }} />
          )}
          <span
            style={{ backgroundColor: colors.badgeBg, color: colors.badgeText }}
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 font-mono"
          >
            {data.category || "COMPONENT"}
          </span>
        </div>
        <div
          style={{ backgroundColor: colors.dotBg }}
          className="w-2 h-2 rounded-full shrink-0"
        />
      </div>

      {/* Label / Inline Input */}
      {isEditing ? (
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={onBlur}
          onKeyDown={(e) => e.key === "Enter" && onBlur()}
          className="nodrag text-xs font-bold outline-none border-b border-orange-500 w-full bg-transparent text-foreground"
        />
      ) : (
        <div
          onDoubleClick={() => setIsEditing(true)}
          className="text-xs font-bold text-foreground tracking-wide overflow-hidden whitespace-pre-line leading-snug cursor-pointer"
          title={label || id}
        >
          {label || id}
        </div>
      )}

      {/* Tech Stack Badges */}
      {data.techStack && data.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-border-subtle">
          {data.techStack.slice(0, 3).map((tech: string) => (
            <span
              key={tech}
              style={{
                backgroundColor: colors.tagBg,
                borderColor: colors.tagBorder,
                color: colors.tagText,
              }}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 border"
            >
              {tech}
            </span>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="w-2.5 h-2.5 rounded-none bg-primary border-none -mr-1.5 opacity-0 pointer-events-none transition-opacity"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        isConnectable={false}
        className="w-2.5 h-2.5 rounded-none bg-primary border-none -ml-1.5 opacity-0 pointer-events-none"
      />
    </div>
  );
}

function GroupNode({ id, data, selected }: any) {
  const colors = getNodeColorStyle(id, data?.label || id);

  return (
    <div
      style={{
        borderColor: colors.borderColor,
        backgroundColor: colors.tagBg,
      }}
      className={`w-full h-full min-w-70 min-h-45 border-2 border-dashed relative p-4 transition-all ${
        selected ? "border-solid ring-2 ring-primary" : ""
      }`}
    >
      <div
        style={{
          backgroundColor: colors.badgeBg,
          color: colors.badgeText,
          borderColor: colors.borderColor,
        }}
        className="absolute -top-3 left-4 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest border shadow-[2px_2px_0px_0px_var(--shadow-color)] font-mono"
      >
        {data?.label || id}
      </div>
    </div>
  );
}

function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: 32,
  });

  return (
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
  );
}

interface ArchitectureGraphProps {
  document: string;
  onDocumentChange: (newDoc: string) => void;
  activeTool: "select" | "move";
  onSelectedNodesChange: (selectedNodes: Node[]) => void;
  updatedNodeData?: { id: string; data: any } | null;
  onCanvasMoveChange?: (isMoving: boolean) => void;
  onGhostDocumentChange?: (ghostDoc: string) => void;
  onNodesEdgesChange?: (nodes: Node[], edges: Edge[]) => void;
  initialNodes?: Node[];
  initialEdges?: Edge[];
  isProjectLoading?: boolean;
}

export default function ArchitectureGraph({
  document,
  onDocumentChange,
  activeTool,
  onSelectedNodesChange,
  updatedNodeData,
  onCanvasMoveChange,
  onGhostDocumentChange,
  onNodesEdgesChange,
  initialNodes,
  initialEdges,
  isProjectLoading = false,
}: ArchitectureGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName;
      if (
        e.code === "Space" &&
        !["INPUT", "TEXTAREA"].includes(targetTag) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const nodeTypes = useRef({
    custom: CustomNode,
    group: GroupNode,
  }).current;
  const edgeTypes = useRef({ architecture: ArchitectureEdge }).current;

  // --- Refs to break circular dependency ---
  // Store saved positions from DB in a ref so they don't trigger re-renders
  const savedPositionsRef = useRef<
    Map<string, { position: { x: number; y: number }; style?: any }>
  >(new Map());
  const hasRestoredFromDBRef = useRef(false);
  const activeTopologyFingerprintRef = useRef<string | null>(null);
  const layoutRevisionRef = useRef(0);
  const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const onNodesEdgesChangeRef = useRef(onNodesEdgesChange);
  onNodesEdgesChangeRef.current = onNodesEdgesChange;
  const documentRef = useRef(document);
  documentRef.current = document;
  const lastValidParsedRef = useRef<any>(null);

  const scheduleFitView = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flowInstanceRef.current?.fitView({ padding: 0.18, duration: 0 });
      });
    });
  }, []);

  // Populate refs when initialNodes/initialEdges arrive from DB (only once)
  useEffect(() => {
    if (
      initialNodes &&
      initialNodes.length > 0 &&
      !hasRestoredFromDBRef.current
    ) {
      const posMap = new Map<
        string,
        { position: { x: number; y: number }; style?: any }
      >();
      initialNodes.forEach((n) => {
        if (n.position && (n.position.x !== 0 || n.position.y !== 0)) {
          posMap.set(n.id, {
            position: { ...n.position },
            style: n.style ? { ...n.style } : undefined,
          });
        }
      });
      savedPositionsRef.current = posMap;
    }
  }, [initialNodes, initialEdges]);

  const onLabelChange = useCallback((id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          n.data = { ...n.data, label: newLabel };
        }
        return n;
      }),
    );
    setTimeout(() => {
      updateMermaidInDocument();
    }, 100);
  }, []);

  // Update specific node data from parent center modal updates
  useEffect(() => {
    if (updatedNodeData) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === updatedNodeData.id) {
            return {
              ...n,
              data: {
                ...n.data,
                ...updatedNodeData.data,
              },
            };
          }
          return n;
        }),
      );
      setTimeout(() => {
        updateMermaidInDocument();
      }, 100);
    }
  }, [updatedNodeData]);

  const DEFAULT_DEMO_MERMAID = `flowchart LR
  subgraph Frontend
    App[Web Application]
  end
  subgraph Backend
    API[API Service]
    DB[(PostgreSQL Database)]
  end
  App --> API
  API --> DB`;

  const renderSyntaxErrorNode = useCallback(
    (reason: string) => {
      const errorNode: Node = {
        id: "syntax-error-node",
        type: "custom",
        selectable: true,
        data: {
          label: "Syntax Error",
          category: "SYNTAX ERROR",
          description: reason,
          techStack: ["Syntax Error", "Fix Document"],
          documentation: `## Syntax Error\n\n${reason}\n\n### Required Format:\nMake sure your document includes a valid \`\`\`architecture block:\n\n\`\`\`architecture\nflowchart LR\n  App[Web Application] --> API[API Service]\n\`\`\``,
          onLabelChange,
        },
        position: { x: 300, y: 150 },
      };
      // Clear saved positions so a fresh ELK layout runs when the diagram is fixed
      savedPositionsRef.current = new Map();
      activeTopologyFingerprintRef.current = null;
      layoutRevisionRef.current++;
      setEdges([]);
      setNodes([errorNode]);
    },
    [onLabelChange, setEdges, setNodes],
  );

  useEffect(() => {
    if (isProjectLoading) {
      layoutRevisionRef.current++;
      return;
    }
    const revision = ++layoutRevisionRef.current;
    const handler = setTimeout(() => {
      const hasText = !!document.trim();

      if (!hasText) {
        const parsed = parseMermaid(DEFAULT_DEMO_MERMAID);
        lastValidParsedRef.current = parsed;
        renderParsedDiagram(parsed);
        return;
      }

      const { valid, reason, parsed } = isValidMermaidDocument(document);

      if (valid && parsed) {
        lastValidParsedRef.current = parsed;
        renderParsedDiagram(parsed);
      } else {
        if (lastValidParsedRef.current) {
          console.warn(
            `[ArchitectureGraph] Preserving active canvas diagram. Document syntax error: ${reason}`,
          );
        } else {
          renderSyntaxErrorNode(reason || "Syntax error parsing diagram code.");
        }
      }
    }, 0);

    const renderParsedDiagram = (parsed: any) => {
      const newNodes = parsed.nodes.map((n: any) => ({
        id: n.id,
        type: n.type === "group" ? "group" : "custom",
        selectable: n.type !== "group",
        extent: n.parent ? ("parent" as const) : undefined,
        data: {
          label: n.label,
          category: n.category,
          description: n.description,
          techStack: n.techStack,
          documentation: n.documentation,
          isGroup: n.type === "group",
          onLabelChange,
        },
        position: { x: 0, y: 0 },
        parentId: n.parent,
      }));

      const newEdges = parsed.edges.map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "architecture",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--foreground)",
        },
        style: { stroke: "var(--foreground)", strokeWidth: 1.5 },
      }));

      const savedMap = savedPositionsRef.current;
      const fingerprint = topologyFingerprint(parsed);
      const topologyChanged =
        activeTopologyFingerprintRef.current !== null &&
        activeTopologyFingerprintRef.current !== fingerprint;
      let restoredAll = false;

      if (
        !topologyChanged &&
        savedMap.size > 0 &&
        savedMap.size >= newNodes.length
      ) {
        let matchCount = 0;
        newNodes.forEach((nn: any) => {
          const saved = savedMap.get(nn.id);
          if (saved && saved.position) {
            nn.position = { ...saved.position };
            if (saved.style) {
              nn.style = { ...saved.style };
            }
            matchCount++;
          }
        });
        restoredAll = matchCount === newNodes.length;
      }

      if (restoredAll) {
        const shouldFitView = !hasRestoredFromDBRef.current || topologyChanged;
        const routedEdges = applyDirectionalHandles(
          newNodes as Node[],
          newEdges as Edge[],
        );
        // All positions restored from DB — skip ELK entirely
        setNodes(newNodes as Node[]);
        setEdges(routedEdges);
        activeTopologyFingerprintRef.current = fingerprint;
        hasRestoredFromDBRef.current = true;
        if (shouldFitView) scheduleFitView();
        if (document.trim()) {
          queueMicrotask(() => {
            onNodesEdgesChangeRef.current?.(newNodes as Node[], routedEdges);
          });
        }
      } else {
        // No saved positions or new nodes added — run ELK layout
        const runLayout = async () => {
          const { nodes: layoutedNodes, edges: layoutedEdges } =
            await getLayoutedElements(
              newNodes as Node[],
              newEdges as Edge[],
              parsed.direction || "LR",
            );

          if (revision !== layoutRevisionRef.current) return;

          const routedEdges = applyDirectionalHandles(
            layoutedNodes,
            layoutedEdges,
          );
          setNodes(layoutedNodes);
          setEdges(routedEdges);
          activeTopologyFingerprintRef.current = fingerprint;
          hasRestoredFromDBRef.current = true;
          scheduleFitView();

          // Save the auto-generated positions
          const posMap = new Map<
            string,
            { position: { x: number; y: number }; style?: any }
          >();
          layoutedNodes.forEach((n: Node) => {
            posMap.set(n.id, {
              position: { ...n.position },
              style: n.style ? { ...n.style } : undefined,
            });
          });
          savedPositionsRef.current = posMap;
          if (document.trim()) {
            queueMicrotask(() => {
              onNodesEdgesChangeRef.current?.(layoutedNodes, routedEdges);
            });
          }
        };
        runLayout();
      }
    };

    return () => clearTimeout(handler);
  }, [
    document,
    isProjectLoading,
    onLabelChange,
    renderSyntaxErrorNode,
    scheduleFitView,
    setEdges,
    setNodes,
  ]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      onNodesChange(changes);
    },
    [onNodesChange],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
      setTimeout(() => {
        updateMermaidInDocument();
      }, 100);
    },
    [setEdges],
  );

  const onNodesDelete = useCallback(() => {
    setTimeout(() => {
      updateMermaidInDocument();
    }, 100);
  }, []);

  const onEdgesDelete = useCallback(() => {
    setTimeout(() => {
      updateMermaidInDocument();
    }, 100);
  }, []);

  const handleNodeDrag = useCallback(
    (_event: any, draggedNode: Node) => {
      setNodes((currentNodes) => {
        const updated = currentNodes.map((n) => ({ ...n }));
        const target = updated.find((n) => n.id === draggedNode.id);
        if (!target) return currentNodes;

        if (target.parentId) {
          // --- CHILD NODE COLLISION PREVENTION WITHIN GROUP ---
          const siblings = updated.filter(
            (n) => n.parentId === target.parentId && n.id !== target.id,
          );
          const targetSize = getVisualNodeSize(target);
          const wNode = targetSize.width;
          const hNode = targetSize.height;
          const CHILD_GAP = 28;

          let posX = Math.max(15, target.position.x);
          let posY = Math.max(35, target.position.y);

          siblings.forEach((other) => {
            const otherSize = getVisualNodeSize(other);
            const wOther = otherSize.width;
            const hOther = otherSize.height;
            const posOther = other.position || { x: 0, y: 0 };

            const overlapX =
              posX < posOther.x
                ? posX + wNode + CHILD_GAP - posOther.x
                : posOther.x + wOther + CHILD_GAP - posX;

            const overlapY =
              posY < posOther.y
                ? posY + hNode + CHILD_GAP - posOther.y
                : posOther.y + hOther + CHILD_GAP - posY;

            if (overlapX > 0 && overlapY > 0) {
              if (overlapX <= overlapY) {
                posX =
                  posX < posOther.x
                    ? posOther.x - wNode - CHILD_GAP
                    : posOther.x + wOther + CHILD_GAP;
              } else {
                posY =
                  posY < posOther.y
                    ? posOther.y - hNode - CHILD_GAP
                    : posOther.y + hOther + CHILD_GAP;
              }
            }
          });

          target.position = {
            x: Math.max(15, posX),
            y: Math.max(35, posY),
          };

          // Dynamically resize parent group container to enclose all child nodes
          const parentId = target.parentId;
          const allChildren = updated.filter((n) => n.parentId === parentId);
          let maxX = 0;
          let maxY = 0;
          allChildren.forEach((c) => {
            const size = getVisualNodeSize(c);
            const cx = (c.position?.x ?? 0) + size.width;
            const cy = (c.position?.y ?? 0) + size.height;
            if (cx > maxX) maxX = cx;
            if (cy > maxY) maxY = cy;
          });

          const parentGroup = updated.find((n) => n.id === parentId);
          if (parentGroup) {
            const reqW = Math.max(maxX + 64, 380);
            const reqH = Math.max(maxY + 56, 230);
            parentGroup.style = {
              ...parentGroup.style,
              width: reqW,
              height: reqH,
            };
          }
        } else {
          // --- TOP-LEVEL NODE / GROUP COLLISION PREVENTION ---
          const topLevel = updated.filter(
            (n) => !n.parentId && n.id !== target.id,
          );
          const targetSize = getVisualNodeSize(target);
          const wNode = targetSize.width;
          const hNode = targetSize.height;
          const GAP = 48;

          let posX = target.position.x;
          let posY = target.position.y;

          topLevel.forEach((other) => {
            const otherSize = getVisualNodeSize(other);
            const wOther = otherSize.width;
            const hOther = otherSize.height;
            const posOther = other.position || { x: 0, y: 0 };

            const overlapX =
              posX < posOther.x
                ? posX + wNode + GAP - posOther.x
                : posOther.x + wOther + GAP - posX;

            const overlapY =
              posY < posOther.y
                ? posY + hNode + GAP - posOther.y
                : posOther.y + hOther + GAP - posY;

            if (overlapX > 0 && overlapY > 0) {
              if (overlapX <= overlapY) {
                if (posX < posOther.x) {
                  posX = posOther.x - wNode - GAP;
                } else {
                  posX = posOther.x + wOther + GAP;
                }
              } else {
                if (posY < posOther.y) {
                  posY = posOther.y - hNode - GAP;
                } else {
                  posY = posOther.y + hOther + GAP;
                }
              }
            }
          });

          target.position = { x: posX, y: posY };
        }

        return updated;
      });
    },
    [setNodes],
  );

  // Persist positions to parent after drag completes
  const handleNodeDragStop = useCallback(
    (_event: any, _draggedNode: Node) => {
      let capturedNodes: Node[] = [];
      let capturedEdges: Edge[] = [];

      setNodes((currentNodes) => {
        setEdges((currentEdges) => {
          // Update the saved positions ref
          const posMap = new Map<
            string,
            { position: { x: number; y: number }; style?: any }
          >();
          currentNodes.forEach((n) => {
            posMap.set(n.id, {
              position: { ...n.position },
              style: n.style ? { ...n.style } : undefined,
            });
          });
          savedPositionsRef.current = posMap;
          // Capture for deferred parent update (can't call parent setState inside updater)
          capturedNodes = currentNodes;
          capturedEdges = currentEdges;

          return currentEdges;
        });
        return currentNodes;
      });

      // Defer the parent callback to after React finishes its current render batch
      queueMicrotask(() => {
        if (documentRef.current.trim() && capturedNodes.length > 0) {
          onNodesEdgesChangeRef.current?.(capturedNodes, capturedEdges);
        }
      });

      setTimeout(() => {
        updateMermaidInDocument();
      }, 100);
    },
    [setNodes, setEdges],
  );

  const handleSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectedNodesChange(
        params.nodes.filter((n) => n.type !== "group" && !n.data?.isGroup),
      );
    },
    [onSelectedNodesChange],
  );

  const updateMermaidInDocument = () => {
    setNodes((currentNodes) => {
      if (currentNodes.some((n) => n.id === "syntax-error-node")) {
        return currentNodes;
      }
      setEdges((currentEdges) => {
        const newMermaid = generateMermaid(currentNodes, currentEdges);

        if (!document.trim()) {
          return currentEdges;
        } else {
          if (!document.includes("```architecture")) {
            return currentEdges;
          }
          const newDoc = document.replace(
            /```architecture\n[\s\S]*?```/,
            `\`\`\`architecture\n${newMermaid}\n\`\`\``,
          );

          if (newDoc !== document) {
            queueMicrotask(() => {
              onDocumentChange(newDoc);
            });
          }
        }
        return currentEdges;
      });
      return currentNodes;
    });
  };

  const styledEdges = useMemo<Edge[]>(() => {
    const selectedSourceNodeIds = new Set(
      nodes.filter((n) => n.selected).map((n) => n.id),
    );

    return edges.map((edge) => {
      const { label, ...restEdge } = edge;
      // Color ONLY outgoing edges (where edge.source is selected)
      if (selectedSourceNodeIds.has(edge.source)) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          const labelStr =
            typeof sourceNode.data?.label === "string"
              ? sourceNode.data.label
              : String(sourceNode.data?.label || sourceNode.id);
          const categoryStr =
            typeof sourceNode.data?.category === "string"
              ? sourceNode.data.category
              : String(sourceNode.data?.category || "");

          const colors = getNodeColorStyle(
            sourceNode.id,
            labelStr,
            categoryStr,
          );
          const edgeColor = colors.borderColor;

          return {
            ...restEdge,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeColor,
            },
            style: {
              ...edge.style,
              stroke: edgeColor,
              strokeWidth: 2.5,
              filter: `drop-shadow(0 0 6px ${edgeColor})`,
            },
          };
        }
      }

      return {
        ...restEdge,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "var(--foreground)",
        },
        style: {
          ...edge.style,
          stroke: "var(--foreground)",
          strokeWidth: 1.5,
          filter: undefined,
        },
      };
    });
  }, [edges, nodes]);

  const isPanMode = activeTool === "move" || isSpacePressed;

  return (
    <div
      className={`h-full w-full bg-canvas-bg relative transition-colors ${
        isPanMode
          ? isMoving
            ? "[&_*]:!cursor-grabbing !cursor-grabbing"
            : "[&_*]:!cursor-grab !cursor-grab"
          : "[&_.react-flow\\_\\_node-custom]:!cursor-pointer [&_.react-flow\\_\\_node-group]:!cursor-default"
      }`}
    >
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDrag={handleNodeDrag}
        onNodeDragStop={handleNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onSelectionChange={handleSelectionChange}
        onNodeClick={(_evt, node) => {
          if (node.type !== "group" && !node.data?.isGroup) {
            onSelectedNodesChange([node]);
          }
        }}
        nodesConnectable={false}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={activeTool === "select" && !isSpacePressed}
        panOnDrag={activeTool === "move" || isSpacePressed}
        panActivationKeyCode="Space"
        selectionOnDrag={activeTool === "select" && !isSpacePressed}
        selectionMode={SelectionMode.Partial}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        onInit={(instance) => {
          flowInstanceRef.current = instance;
        }}
        onMoveStart={() => {
          setIsMoving(true);
          onCanvasMoveChange?.(true);
        }}
        onMoveEnd={() => {
          setIsMoving(false);
          onCanvasMoveChange?.(false);
        }}
        fitView
        attributionPosition="bottom-right"
      >
        <Background
          gap={24}
          size={1.5}
          color="var(--dot-color)"
          style={{ opacity: 0.8 }}
        />
      </ReactFlow>
    </div>
  );
}
