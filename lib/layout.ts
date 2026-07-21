import ELK, { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk.bundled.js";
import { Edge, Node } from "@xyflow/react";

const elk = new ELK();

const NODE_WIDTH = 270;
const GROUP_MIN_WIDTH = 380;
const GROUP_MIN_HEIGHT = 230;

export function getVisualNodeSize(node: Node) {
  const isGroup = node.type === "group" || node.data?.isGroup;
  if (isGroup) {
    return {
      width:
        typeof node.style?.width === "number"
          ? node.style.width
          : GROUP_MIN_WIDTH,
      height:
        typeof node.style?.height === "number"
          ? node.style.height
          : GROUP_MIN_HEIGHT,
    };
  }

  const label = String(node.data?.label || node.id);
  const labelLines = label
    .split("\n")
    .reduce(
      (count, line) => count + Math.max(1, Math.ceil(line.length / 29)),
      0,
    );
  const technologies = Array.isArray(node.data?.techStack)
    ? node.data.techStack.slice(0, 3).map(String)
    : [];
  let techRows = 0;
  let currentRowWidth = 0;
  technologies.forEach((technology) => {
    const tagWidth = technology.length * 7 + 26;
    if (currentRowWidth > 0 && currentRowWidth + tagWidth > NODE_WIDTH - 28) {
      techRows++;
      currentRowWidth = 0;
    }
    if (currentRowWidth === 0) techRows++;
    currentRowWidth += tagWidth;
  });

  return {
    width: NODE_WIDTH,
    height: Math.max(
      112,
      72 + labelLines * 18 + (techRows ? techRows * 25 + 15 : 0),
    ),
  };
}

export async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = "LR",
) {
  const isHorizontal = direction === "LR";
  const elkNodes = new Map<string, ElkNode>();

  nodes.forEach((node) => {
    const isGroup = node.type === "group" || node.data?.isGroup;
    const size = getVisualNodeSize(node);
    elkNodes.set(node.id, {
      id: node.id,
      width: size.width,
      height: size.height,
      ...(isGroup ? { children: [] } : {}),
      layoutOptions: isGroup
        ? {
            "elk.algorithm": "layered",
            "elk.direction": isHorizontal ? "RIGHT" : "DOWN",
            "elk.spacing.nodeNode": "96",
            "elk.layered.spacing.nodeNodeBetweenLayers": "164",
            "elk.padding": "[top=72,left=64,bottom=56,right=64]",
          }
        : undefined,
    });
  });

  const rootChildren: ElkNode[] = [];
  nodes.forEach((node) => {
    const elkNode = elkNodes.get(node.id);
    if (!elkNode) return;
    if (node.parentId && elkNodes.has(node.parentId)) {
      const parent = elkNodes.get(node.parentId)!;
      parent.children ??= [];
      parent.children.push(elkNode);
    } else {
      rootChildren.push(elkNode);
    }
  });

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const rootGraph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": isHorizontal ? "RIGHT" : "DOWN",
      "elk.spacing.nodeNode": "132",
      "elk.layered.spacing.nodeNodeBetweenLayers": "220",
      "elk.padding": "[top=72,left=72,bottom=72,right=72]",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.layered.compaction.postCompaction.strategy": "EDGE_LENGTH",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.componentComponent": "160",
      "elk.edgeLabels.placement": "CENTER",
    },
    children: rootChildren,
    edges: elkEdges,
  };

  try {
    const layout = await elk.layout(rootGraph);
    const positions = new Map<
      string,
      { x: number; y: number; width?: number; height?: number }
    >();
    const collect = (elkNode: ElkNode) => {
      if (elkNode.id !== "root") {
        positions.set(elkNode.id, {
          x: elkNode.x || 0,
          y: elkNode.y || 0,
          width: elkNode.width,
          height: elkNode.height,
        });
      }
      elkNode.children?.forEach(collect);
    };
    collect(layout);

    nodes.forEach((node) => {
      const position = positions.get(node.id);
      if (!position) return;
      node.position = { x: Math.round(position.x), y: Math.round(position.y) };
      if (node.type === "group" || node.data?.isGroup) {
        node.style = {
          ...node.style,
          width: Math.max(
            GROUP_MIN_WIDTH,
            Math.ceil(position.width || GROUP_MIN_WIDTH),
          ),
          height: Math.max(
            GROUP_MIN_HEIGHT,
            Math.ceil(position.height || GROUP_MIN_HEIGHT),
          ),
          minWidth: GROUP_MIN_WIDTH,
          minHeight: GROUP_MIN_HEIGHT,
        };
      }
    });
  } catch (error) {
    console.error("[ELK Layout Error]:", error);
  }

  return { nodes, edges };
}
