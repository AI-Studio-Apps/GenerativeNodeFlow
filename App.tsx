
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Node, Edge, Point, HistoryItem, NodeInput, NodeOutput, Group, Theme, Shortcuts } from './types';
import { NodeType, NodeStatus } from './types';
import Sidebar from './components/Sidebar';
import NodeComponent from './components/Node';
import EdgeComponent from './components/Edge';
import GroupComponent from './components/GroupComponent';
import HistorySidebar from './components/HistorySidebar';
import SettingsPanel from './components/SettingsPanel';
import AppModeView from './components/AppModeView';
import { PlayIcon, SaveIcon, FolderOpenIcon, SettingsIcon, AppWindowIcon, CanvasViewIcon, EyeIcon, EyeOffIcon } from './components/icons';
import * as geminiService from './services/geminiService';
import { PRESET_CONFIGS } from './presets';

const createNode = (type: NodeType, position: Point, presetId?: string): Node => {
  const id = crypto.randomUUID();
  const baseNode = { id, type, position, data: { status: NodeStatus.IDLE, content: null, inputs: [] as NodeInput[], outputs: [] as NodeOutput[], isMuted: false } };

  switch (type) {
    case NodeType.TEXT_INPUT:
      return { ...baseNode, data: { ...baseNode.data, width: 320, height: 150, label: 'Text Input', outputs: [{ id: `${id}-output`, label: 'Text', type: 'text' }] } };
    case NodeType.IMAGE_INPUT:
      return { ...baseNode, data: { ...baseNode.data, width: 350, label: 'Image Input', outputs: [{ id: `${id}-output`, label: 'Image', type: 'image' }] } };
    case NodeType.TEXT_GENERATOR:
      return { ...baseNode, data: { ...baseNode.data, width: 320, height: 100, label: 'Text Generator', inputs: [{ id: `${id}-input`, label: 'Prompt', type: 'text' }], outputs: [{ id: `${id}-output`, label: 'Text', type: 'text' }] } };
    case NodeType.IMAGE_EDITOR:
      return { ...baseNode, data: { ...baseNode.data, width: 320, height: 100, label: 'Image Generator/Editor', inputs: [{ id: `${id}-input-image`, label: 'Image (Optional)', type: 'image' }, { id: `${id}-input-text`, label: 'Prompt', type: 'text' }], outputs: [{ id: `${id}-output-image`, label: 'Image', type: 'image' }, { id: `${id}-output-text`, label: 'Text', type: 'text' }] } };
    case NodeType.VIDEO_GENERATOR:
      return { ...baseNode, data: { ...baseNode.data, width: 320, height: 100, label: 'Video Generator', inputs: [{ id: `${id}-input-image`, label: 'Image', type: 'image' }, { id: `${id}-input-text`, label: 'Text', type: 'text' }], outputs: [{ id: `${id}-output`, label: 'Video', type: 'video' }] } };
    case NodeType.OUTPUT_DISPLAY:
      return { ...baseNode, data: { ...baseNode.data, width: 350, label: 'Output', inputs: [{ id: `${id}-input`, label: 'Input', type: 'any' }] } };
    case NodeType.PROMPT_PRESET:
        if (!presetId || !PRESET_CONFIGS[presetId]) {
            throw new Error(`Unknown presetId: ${presetId}`);
        }
        const config = PRESET_CONFIGS[presetId];
        let inputs: NodeInput[];
        // If a preset has multiple inputs and they are all images, create a single combined input handle.
        if (config.inputs.length > 1 && config.inputs.every(i => i.type === 'image')) {
            inputs = [{ label: 'Images', type: 'image', id: `${id}-input-multi-image` }];
        } else {
            inputs = config.inputs.map((input, index) => ({ ...input, id: `${id}-input-${index}`}));
        }
        const outputs = config.outputs.map((output, index) => ({ ...output, id: `${id}-output-${index}`}));
        return { ...baseNode, data: { ...baseNode.data, width: 150, height: 150, label: config.label, prompt: config.prompt, inputs, outputs } };
    default:
      throw new Error("Unknown node type");
  }
};

const getRandomColor = () => {
    const colors = [
        'rgba(239, 68, 68, 0.2)', // red
        'rgba(249, 115, 22, 0.2)', // orange
        'rgba(234, 179, 8, 0.2)', // amber
        'rgba(132, 204, 22, 0.2)', // lime
        'rgba(34, 197, 94, 0.2)', // green
        'rgba(16, 185, 129, 0.2)', // emerald
        'rgba(20, 184, 166, 0.2)', // teal
        'rgba(6, 182, 212, 0.2)', // cyan
        'rgba(59, 130, 246, 0.2)', // blue
        'rgba(139, 92, 246, 0.2)', // violet
        'rgba(168, 85, 247, 0.2)', // purple
        'rgba(217, 70, 239, 0.2)', // fuchsia
        'rgba(236, 72, 153, 0.2)', // pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

const DEFAULT_THEME: Theme = {
    canvasBackground: '#000000',
    nodeBackground: '#171717',
    nodeOpacity: 0.7,
    nodeTextColor: '#ffffff',
    uploaderTextColor: '#6b7280',
    canvasBackgroundImage: null,
    edgeWidth: 2,
    edgeColors: {
        text: '#f59e0b',
        image: '#d1d5db',
        video: '#3b82f6',
        any: '#a3a3a3',
    },
    buttonColor: '#4f46e5',
};

const DEFAULT_SHORTCUTS: Shortcuts = {
    run: 'Enter',
    save: 's',
    load: 'o',
    copy: 'c',
    paste: 'v',
    delete: 'Delete',
    group: 'g',
    ungroup: 'g',
    mute: 'm',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    if (!hex || typeof hex !== 'string') return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
}

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [edges, setEdges] = useState<Record<string, Edge>>({});
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [connectingEdgeEnd, setConnectingEdgeEnd] = useState<Point | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set<string>());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectionBoxDiv, setSelectionBoxDiv] = useState<{ top: number; left: number; width: number; height: number; } | null>(null);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [shortcuts, setShortcuts] = useState<Shortcuts>(DEFAULT_SHORTCUTS);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isNodeSidebarCollapsed, setIsNodeSidebarCollapsed] = useState(false);
  const [isHistorySidebarCollapsed, setIsHistorySidebarCollapsed] = useState(false);
  const [editingPromptNode, setEditingPromptNode] = useState<Node | null>(null);
  const [editedPromptValue, setEditedPromptValue] = useState('');
  const [isAppMode, setIsAppMode] = useState(false);
  const [showEdges, setShowEdges] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' | 'critical' } | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // AI Configuration State
  const [aiConfig, setAiConfig] = useState(() => {
    return {
        apiKey: localStorage.getItem('gemini_api_key') || process.env.API_KEY || '',
        model: localStorage.getItem('gemini_model') || 'gemini-3-flash-preview',
        url: localStorage.getItem('gemini_url') || ''
    };
  });
  
  const dragInfo = useRef<{ initialPositions: Map<string, Point>; startMousePos: Point; } | null>(null);
  const groupDragInfo = useRef<{ groupId: string; startMousePos: Point; initialNodePositions: Map<string, Point>; } | null>(null);
  const clipboard = useRef<{ nodes: Node[], edges: Edge[] } | null>(null);
  const connectingEdge = useRef<{ sourceNodeId: string; sourceHandleId: string; } | null>(null);
  const panState = useRef<{ startX: number, startY: number } | null>(null);
  const resizingNode = useRef<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number; } | null>(null);
  const selectionBox = useRef<{ start: Point; end: Point; } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zIndexCounter = useRef(1);

  // Update Service and Storage when AI Config changes
  useEffect(() => {
    geminiService.updateConfig(aiConfig.apiKey, aiConfig.model, aiConfig.url);
    localStorage.setItem('gemini_api_key', aiConfig.apiKey);
    localStorage.setItem('gemini_model', aiConfig.model);
    localStorage.setItem('gemini_url', aiConfig.url);
  }, [aiConfig]);

  // Initial check for API Key
  useEffect(() => {
    if (!aiConfig.apiKey) {
         setNotification({
             message: "Missing API Key! Please configure the AI Model settings in the Settings panel.",
             type: 'critical'
         });
         setIsSettingsPanelOpen(true);
    }
  }, []);

  useEffect(() => {
    if (notification) {
      const duration = notification.type === 'critical' ? 10000 : 5000;
      const timer = setTimeout(() => {
        setNotification(null);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const addNode = useCallback((type: NodeType, presetId?: string) => {
    const newNode = createNode(type, { 
        x: (300 - viewTransform.x) / viewTransform.scale, 
        y: (150 - viewTransform.y) / viewTransform.scale
    }, presetId);
    newNode.zIndex = zIndexCounter.current++;
    setNodes(prev => ({ ...prev, [newNode.id]: newNode }));
  }, [viewTransform]);
  
  const addNodeFromHistory = useCallback((dataUrl: string) => {
    const newNode = createNode(NodeType.IMAGE_INPUT, {
        x: (400 - viewTransform.x) / viewTransform.scale,
        y: (200 - viewTransform.y) / viewTransform.scale,
    });
    newNode.zIndex = zIndexCounter.current++;
    newNode.data.content = dataUrl;
    setNodes(prev => ({...prev, [newNode.id]: newNode }));
  }, [viewTransform]);

  const updateNodeData = useCallback((nodeId: string, data: Partial<Node['data']>) => {
    setNodes(prev => {
        if (!prev[nodeId]) return prev;
        return {
            ...prev,
            [nodeId]: { ...prev[nodeId], data: { ...prev[nodeId].data, ...data } },
        }
    });
  }, []);

  const updateGroup = useCallback((groupId: string, data: Partial<Group>) => {
    setGroups(prev => {
        if (!prev[groupId]) return prev;
        return { ...prev, [groupId]: { ...prev[groupId], ...data } };
    });
  }, []);
  
  const handleDeleteGroup = useCallback((groupId: string) => {
    setGroups(prev => {
        const newGroups = { ...prev };
        delete newGroups[groupId];
        return newGroups;
    });
  }, []);

  const getHandlePosition = useCallback((nodeId: string, handleId: string): Point => {
    const handleElem = document.getElementById(handleId);
    if (!handleElem || !canvasRef.current) return { x: 0, y: 0 };
    
    const handleRect = handleElem.getBoundingClientRect();
    const canvasRect = canvasRef.current.getBoundingClientRect();

    const screenX = handleRect.left + handleRect.width / 2 - canvasRect.left;
    const screenY = handleRect.top + handleRect.height / 2 - canvasRect.top;
    
    const worldX = (screenX - viewTransform.x) / viewTransform.scale;
    const worldY = (screenY - viewTransform.y) / viewTransform.scale;

    return { x: worldX, y: worldY };
  }, [viewTransform]);

  const handleMouseDownNode = useCallback((e: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
    e.stopPropagation();

    // Bring clicked node to front
    setNodes(prev => {
        if (!prev[nodeId]) return prev;
        const newNodes = { ...prev };
        newNodes[nodeId] = { ...newNodes[nodeId], zIndex: zIndexCounter.current++ };
        return newNodes;
    });
    
    resizingNode.current = null;
    setSelectedEdgeId(null);
    groupDragInfo.current = null;


    const newSelectedIds = (() => {
        if (e.shiftKey) {
            const newSet = new Set(selectedNodeIds);
            if (newSet.has(nodeId)) newSet.delete(nodeId);
            else newSet.add(nodeId);
            return newSet;
        } else {
            return selectedNodeIds.has(nodeId) ? selectedNodeIds : new Set([nodeId]);
        }
    })();
    setSelectedNodeIds(newSelectedIds);
    
    const initialPositions = new Map<string, Point>();
    newSelectedIds.forEach(id => {
        if(nodes[id]) initialPositions.set(id, nodes[id].position);
    });

    dragInfo.current = {
      initialPositions,
      startMousePos: { x: e.clientX, y: e.clientY },
    };
  }, [nodes, selectedNodeIds]);

  const handleMouseDownGroup = useCallback((e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    dragInfo.current = null;
    resizingNode.current = null;
    
    const group = groups[groupId];
    if (!group) return;

    const initialNodePositions = new Map<string, Point>();
    group.nodeIds.forEach(nodeId => {
        if (nodes[nodeId]) {
            initialNodePositions.set(nodeId, nodes[nodeId].position);
        }
    });

    groupDragInfo.current = {
        groupId,
        startMousePos: { x: e.clientX, y: e.clientY },
        initialNodePositions,
    };
  }, [groups, nodes]);


  const handleMouseDownHandle = useCallback((e: React.MouseEvent<HTMLDivElement>, nodeId: string, handleId: string, handleType: 'input' | 'output') => {
    e.stopPropagation();
    if (handleType === 'output') {
      connectingEdge.current = { sourceNodeId: nodeId, sourceHandleId: handleId };
      setConnectingEdgeEnd(getHandlePosition(nodeId, handleId));
    } else { // Handle 'input' for disconnection
        const targetNode = nodes[nodeId];
        const isMultiImageHandle = targetNode?.type === NodeType.PROMPT_PRESET && handleId === `${nodeId}-input-multi-image`;

        // Don't allow unplugging from multi-image handles as it's not a 1-to-1 connection.
        if (isMultiImageHandle) {
            return;
        }

        const connectedEdge = Object.values(edges).find((edge: Edge) => edge.targetNodeId === nodeId && edge.targetHandleId === handleId);
        if (connectedEdge) {
            setEdges(prev => {
                const newEdges = { ...prev };
                delete newEdges[connectedEdge.id];
                return newEdges;
            });
            connectingEdge.current = { 
                sourceNodeId: connectedEdge.sourceNodeId, 
                sourceHandleId: connectedEdge.sourceHandleId 
            };
            setConnectingEdgeEnd(getHandlePosition(nodeId, handleId));
        }
    }
  }, [getHandlePosition, edges, nodes]);

   const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, nodeId: string) => {
    e.stopPropagation();
    dragInfo.current = null;
    groupDragInfo.current = null;
    const node = nodes[nodeId];
    if (!node) return;
    resizingNode.current = {
        id: nodeId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: node.data.width || 320,
        startHeight: node.data.height || 150,
    };
   },[nodes]);
   
   const handleEdgeClick = useCallback((edgeId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedNodeIds(new Set());
      setSelectedEdgeId(prevId => prevId === edgeId ? null : edgeId);
    }, []);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomIntensity;
        const newScale = Math.min(Math.max(0.2, viewTransform.scale + delta), 2.5);

        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (canvasRect) {
             const mouseX = e.clientX - canvasRect.left;
             const mouseY = e.clientY - canvasRect.top;
             
             const worldX = (mouseX - viewTransform.x) / viewTransform.scale;
             const worldY = (mouseY - viewTransform.y) / viewTransform.scale;
             
             const newX = mouseX - worldX * newScale;
             const newY = mouseY - worldY * newScale;
             
             setViewTransform({ scale: newScale, x: newX, y: newY });
        }
    } else {
        setViewTransform(prev => ({
            ...prev,
            x: prev.x - e.deltaX,
            y: prev.y - e.deltaY,
        }));
    }
  }, [viewTransform]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) { 
          e.preventDefault();
          panState.current = { startX: e.clientX, startY: e.clientY };
          if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
          return;
      }
      
      if (e.button === 0) {
          if (canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              selectionBox.current = { start: { x, y }, end: { x, y } };
              setSelectionBoxDiv({ left: x, top: y, width: 0, height: 0 });
              if (!e.shiftKey) {
                  setSelectedNodeIds(new Set());
              }
              setSelectedEdgeId(null);
          }
      }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const content = event.target?.result as string;
              const data = JSON.parse(content);
              
              if (data.nodes && Array.isArray(data.nodes)) {
                 const newNodes: Record<string, Node> = {};
                 data.nodes.forEach((n: Node) => { newNodes[n.id] = n; });
                 setNodes(newNodes);
              }
              if (data.edges && Array.isArray(data.edges)) {
                  const newEdges: Record<string, Edge> = {};
                  data.edges.forEach((e: Edge) => { newEdges[e.id] = e; });
                  setEdges(newEdges);
              }
              if (data.groups && Array.isArray(data.groups)) {
                  const newGroups: Record<string, Group> = {};
                  data.groups.forEach((g: Group) => { newGroups[g.id] = g; });
                  setGroups(newGroups);
              } else if (data.groups) {
                   setGroups(data.groups);
              } else {
                  setGroups({});
              }

              if (data.history) setHistory(data.history);
              if (data.viewTransform) setViewTransform(data.viewTransform);
              if (data.theme) setTheme(data.theme);
              if (data.shortcuts) setShortcuts(data.shortcuts);

              setNotification({ message: 'Workflow loaded successfully!', type: 'success' });
          } catch (err) {
              console.error("Load error:", err);
              setNotification({ message: 'Failed to load workflow file.', type: 'error' });
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (selectionBox.current && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            selectionBox.current.end = { x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top };
            const { start, end } = selectionBox.current;
            const left = Math.min(start.x, end.x);
            const top = Math.min(start.y, end.y);
            const width = Math.abs(start.x - end.x);
            const height = Math.abs(start.y - end.y);
            setSelectionBoxDiv({ left, top, width, height });
        } else if (groupDragInfo.current) {
            const { startMousePos, initialNodePositions } = groupDragInfo.current;
            const dx = (e.clientX - startMousePos.x) / viewTransform.scale;
            const dy = (e.clientY - startMousePos.y) / viewTransform.scale;

            setNodes(prev => {
                const newNodes = { ...prev };
                initialNodePositions.forEach((startPos, nodeId) => {
                    if (newNodes[nodeId]) {
                        newNodes[nodeId] = {
                            ...newNodes[nodeId],
                            position: { x: startPos.x + dx, y: startPos.y + dy }
                        };
                    }
                });
                return newNodes;
            });
        } else if (resizingNode.current) {
            const { id, startX, startY, startWidth, startHeight } = resizingNode.current;
            const dx = (e.clientX - startX) / viewTransform.scale;
            const dy = (e.clientY - startY) / viewTransform.scale;
            const newWidth = Math.max(150, startWidth + dx);
            const newHeight = Math.max(80, startHeight + dy);
            updateNodeData(id, { width: newWidth, height: newHeight });
        } else if (panState.current) {
            const dx = e.clientX - panState.current.startX;
            const dy = e.clientY - panState.current.startY;
            setViewTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
            panState.current = { startX: e.clientX, startY: e.clientY };
        } else if (dragInfo.current) {
            const { initialPositions, startMousePos } = dragInfo.current;
            const dx = (e.clientX - startMousePos.x) / viewTransform.scale;
            const dy = (e.clientY - startMousePos.y) / viewTransform.scale;

            setNodes(prev => {
                const newNodes = { ...prev };
                initialPositions.forEach((startPos, id) => {
                    if (newNodes[id]) {
                        newNodes[id] = {
                            ...newNodes[id],
                            position: { x: startPos.x + dx, y: startPos.y + dy }
                        };
                    }
                });
                return newNodes;
            });
        } else if (connectingEdge.current) {
            const canvasRect = canvasRef.current?.getBoundingClientRect();
            if(canvasRect) {
                const worldX = (e.clientX - canvasRect.left - viewTransform.x) / viewTransform.scale;
                const worldY = (e.clientY - canvasRect.top - viewTransform.y) / viewTransform.scale;
                setConnectingEdgeEnd({ x: worldX, y: worldY });
            }
        }
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (selectionBox.current && canvasRef.current) {
            const { start, end } = selectionBox.current; // These are canvas-relative

            const boxStartWorld = {
                x: (Math.min(start.x, end.x) - viewTransform.x) / viewTransform.scale,
                y: (Math.min(start.y, end.y) - viewTransform.y) / viewTransform.scale
            };
            const boxEndWorld = {
                x: (Math.max(start.x, end.x) - viewTransform.x) / viewTransform.scale,
                y: (Math.max(start.y, end.y) - viewTransform.y) / viewTransform.scale
            };
            
            const newSelectedIds = e.shiftKey ? new Set(selectedNodeIds) : new Set<string>();
            Object.values(nodes).forEach((node: Node) => {
                const nodeWidth = node.data.width || 250;
                const nodeHeight = node.data.height || 150;
                
                const nodeLeft = node.position.x;
                const nodeRight = node.position.x + nodeWidth;
                const nodeTop = node.position.y;
                const nodeBottom = node.position.y + nodeHeight;

                if (nodeRight > boxStartWorld.x && nodeLeft < boxEndWorld.x && nodeBottom > boxStartWorld.y && nodeTop < boxEndWorld.y) {
                    if (newSelectedIds.has(node.id) && e.shiftKey) {
                        newSelectedIds.delete(node.id);
                    } else {
                        newSelectedIds.add(node.id);
                    }
                }
            });
            setSelectedNodeIds(newSelectedIds);
        } else if (connectingEdge.current) {
            const target = e.target as HTMLElement;
            const { sourceNodeId, sourceHandleId } = connectingEdge.current;
        
            let targetNodeId: string | null = null;
            let targetHandleId: string | null = null;
        
            const targetHandle = target.closest('[data-handle-type="input"]');
            if (targetHandle) { // Case 1: Precise drop on a handle
                const targetNodeElement = targetHandle.closest('[data-node-id]');
                targetNodeId = targetNodeElement?.getAttribute('data-node-id');
                targetHandleId = targetHandle.id;
            } else { // Case 2: Drop on a node body, auto-find a compatible handle
                const targetNodeElement = target.closest('[data-node-id]');
                const potentialTargetNodeId = targetNodeElement?.getAttribute('data-node-id');
        
                if (potentialTargetNodeId) {
                    const sourceNode = nodes[sourceNodeId];
                    const sourceHandle = sourceNode?.data.outputs.find(o => o.id === sourceHandleId);
                    const sourceType = sourceHandle?.type;
                    const targetNode = nodes[potentialTargetNodeId];
        
                    if (targetNode && sourceType && sourceNodeId !== potentialTargetNodeId) {
                        for (const input of targetNode.data.inputs) {
                            const isTypeCompatible = sourceType === input.type || input.type === 'any' || sourceType === 'any';
                            if (!isTypeCompatible) continue;
        
                            const isMultiImageHandle = targetNode.type === NodeType.PROMPT_PRESET && input.id.endsWith('-input-multi-image');
                            const isAlreadyConnected = Object.values(edges).some(
                                (edge: Edge) => edge.targetNodeId === potentialTargetNodeId && edge.targetHandleId === input.id
                            );
        
                            if (!isAlreadyConnected || isMultiImageHandle) {
                                targetNodeId = potentialTargetNodeId;
                                targetHandleId = input.id;
                                break; // Found the first available compatible input
                            }
                        }
                    }
                }
            }
        
            // Final check and edge creation
            if (targetNodeId && targetHandleId && sourceNodeId !== targetNodeId) {
                const targetNode = nodes[targetNodeId];
                const isMultiImageHandle = targetNode?.type === NodeType.PROMPT_PRESET && targetHandleId.endsWith('-input-multi-image');
                const isAlreadyConnected = Object.values(edges).some(
                    (edge: Edge) => edge.targetNodeId === targetNodeId && edge.targetHandleId === targetHandleId
                );
        
                if (!isAlreadyConnected || isMultiImageHandle) {
                    const newEdge: Edge = {
                        id: crypto.randomUUID(),
                        sourceNodeId,
                        sourceHandleId,
                        targetNodeId,
                        targetHandleId,
                    };
                    setEdges(prev => ({ ...prev, [newEdge.id]: newEdge }));
                }
            }
        }
        
        if (panState.current && canvasRef.current) canvasRef.current.style.cursor = 'default';
        selectionBox.current = null;
        setSelectionBoxDiv(null);
        dragInfo.current = null;
        groupDragInfo.current = null;
        connectingEdge.current = null;
        panState.current = null;
        resizingNode.current = null;
        setConnectingEdgeEnd(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [viewTransform, updateNodeData, nodes, edges, selectedNodeIds]);

  const runWorkflow = useCallback(async () => {
    setIsProcessing(true);
    setNotification({ message: 'Workflow started...', type: 'info' });
    
    setNodes(prev => {
        const newNodes = {...prev};
        Object.keys(newNodes).forEach(id => {
            newNodes[id].data.status = NodeStatus.IDLE;
            newNodes[id].data.errorMessage = undefined;
            if(newNodes[id].type !== NodeType.TEXT_INPUT && newNodes[id].type !== NodeType.IMAGE_INPUT) {
                newNodes[id].data.content = null;
            }
        });
        return newNodes;
    });

    const nodeIds = Object.keys(nodes);
    const adj: Record<string, string[]> = nodeIds.reduce((acc, id) => ({ ...acc, [id]: [] }), {});
    const inDegree: Record<string, number> = nodeIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});

    Object.values(edges).forEach((edge: Edge) => {
      adj[edge.sourceNodeId].push(edge.targetNodeId);
      inDegree[edge.targetNodeId]++;
    });

    const queue = nodeIds.filter(id => inDegree[id] === 0);
    const executionOrder: string[] = [];
    while (queue.length > 0) {
      const u = queue.shift()!;
      executionOrder.push(u);
      adj[u]?.forEach(v => {
        inDegree[v]--;
        if (inDegree[v] === 0) queue.push(v);
      });
    }

    const nodeOutputs: Record<string, any> = {};
    let hasError = false;

    for (const nodeId of executionOrder) {
      const node = nodes[nodeId];
      
      const inputEdges = Object.values(edges).filter((e: Edge) => e.targetNodeId === nodeId);
      const inputs: Record<string, any> = {};
      for (const edge of inputEdges) {
          inputs[edge.targetHandleId] = nodeOutputs[edge.sourceHandleId];
      }
      
      if (node.data.isMuted) {
          updateNodeData(nodeId, { status: NodeStatus.COMPLETED });
          const firstInputHandle = node.data.inputs[0];
          if (firstInputHandle) {
              const inputValue = inputs[firstInputHandle.id];
              node.data.outputs.forEach(outputHandle => {
                  nodeOutputs[outputHandle.id] = inputValue;
              });
          }
          continue;
      }
      
      updateNodeData(nodeId, { status: NodeStatus.PROCESSING, content: { progress: 'Starting...' } });

      try {
        let output: any;

        const processImageInput = async (imageInput: any) => {
            if (!imageInput) return null;
            if (imageInput instanceof File) {
                const part = await geminiService.utils.fileToGenerativePart(imageInput);
                return { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
            }
            if (typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
                const [meta, base64] = imageInput.split(',');
                const mimeType = meta.split(':')[1].split(';')[0];
                return { data: base64, mimeType };
            }
            return null;
        }

        switch (node.type) {
            case NodeType.TEXT_INPUT:
            case NodeType.IMAGE_INPUT:
              output = node.data.content;
              break;
            case NodeType.TEXT_GENERATOR:
              const prompt = inputs[`${nodeId}-input`];
              output = await geminiService.generateText(prompt);
              break;
            case NodeType.IMAGE_EDITOR: {
                const imageInput = inputs[`${nodeId}-input-image`];
                const textInput = inputs[`${nodeId}-input-text`];

                if (!textInput) {
                    throw new Error("A text prompt is required for image generation/editing.");
                }

                const imageFile = await processImageInput(imageInput);

                if (imageFile) {
                    // Edit mode
                    const result = await geminiService.editImage(imageFile.data, imageFile.mimeType, textInput);
                    if (result && result.newBase64Image) {
                        const dataUrl = `data:${imageFile.mimeType};base64,${result.newBase64Image}`;
                        output = { image: dataUrl, text: result.text };

                        const historyItem: HistoryItem = {
                            id: crypto.randomUUID(),
                            type: 'image',
                            dataUrl: dataUrl,
                            prompt: textInput,
                        };
                        setHistory(prev => [historyItem, ...prev]);

                    } else {
                        throw new Error(result.text || "Image editing failed to produce an image.");
                    }
                } else {
                    // Generation mode
                    const result = await geminiService.generateImage(textInput);
                    if (result && result.startsWith('data:image')) {
                        output = { image: result, text: null }; // Keep output format consistent
                        
                        const historyItem: HistoryItem = {
                            id: crypto.randomUUID(),
                            type: 'image',
                            dataUrl: result,
                            prompt: textInput,
                        };
                        setHistory(prev => [historyItem, ...prev]);
                    } else {
                         throw new Error(result || "Image generation failed.");
                    }
                }
                break;
            }
            case NodeType.PROMPT_PRESET: {
                let imageInputsRaw: any[];
                const multiImageInput = node.data.inputs.find(i => i.id === `${nodeId}-input-multi-image`);

                if (multiImageInput) {
                    // Get all inputs connected to the single multi-image handle
                    const multiInputEdges = Object.values(edges).filter((e: Edge) => e.targetNodeId === nodeId && e.targetHandleId === multiImageInput.id);
                    imageInputsRaw = multiInputEdges.map((edge: Edge) => nodeOutputs[edge.sourceHandleId]);
                } else {
                    // Default behavior for presets with single/mixed inputs
                    imageInputsRaw = node.data.inputs.map(input => inputs[input.id]);
                }

                const imageFilesPromises = imageInputsRaw.map(processImageInput);
                const imageFiles = (await Promise.all(imageFilesPromises)).filter(Boolean) as {data: string, mimeType: string}[];
                
                if (imageFiles.length > 0 && node.data.prompt) {
                    const result = await geminiService.executePreset(imageFiles, node.data.prompt);
                     if (result && result.newBase64Image) {
                      const dataUrl = `data:${imageFiles[0].mimeType};base64,${result.newBase64Image}`;
                      output = { image: dataUrl, text: result.text };
                      
                      const historyItem: HistoryItem = {
                          id: crypto.randomUUID(),
                          type: 'image',
                          dataUrl: dataUrl,
                          prompt: node.data.prompt,
                      };
                      setHistory(prev => [historyItem, ...prev]);

                  } else {
                      throw new Error(result.text || "Preset failed to produce an image.");
                  }
                } else {
                    throw new Error(`Missing required inputs for preset: ${node.data.label}`);
                }
                break;
            }
            case NodeType.VIDEO_GENERATOR: {
              const imageInput = inputs[`${nodeId}-input-image`];
              const textInput = inputs[`${nodeId}-input-text`];
              const imageFile = await processImageInput(imageInput);

              output = await geminiService.generateVideo(
                  imageFile?.data || null,
                  imageFile?.mimeType || null,
                  textInput,
                  (progress) => { updateNodeData(nodeId, { content: { progress } }); }
              );
              break;
            }
            case NodeType.OUTPUT_DISPLAY:
              output = inputs[`${nodeId}-input`];
              break;
        }

        updateNodeData(nodeId, { status: NodeStatus.COMPLETED, content: output });
        
        node.data.outputs.forEach(o => {
          if ((node.type === NodeType.IMAGE_EDITOR || node.type === NodeType.PROMPT_PRESET) && output && typeof output === 'object' && 'image' in output) {
            nodeOutputs[o.id] = o.type === 'image' ? output.image : output.text;
          } else {
            nodeOutputs[o.id] = output;
          }
        });

      } catch (error) {
        console.error("Workflow error at node", nodeId, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        updateNodeData(nodeId, { status: NodeStatus.ERROR, errorMessage });
        setNotification({ message: `Error at node "${node.data.label}": ${errorMessage}`, type: 'error' });
        hasError = true;
        setIsProcessing(false);
        return;
      }
    }

    if (!hasError) {
        setNotification({ message: 'Workflow completed successfully!', type: 'success' });
    }
    setIsProcessing(false);
  }, [nodes, edges, updateNodeData]);
  
  const downloadWorkflow = useCallback(() => {
      const workflow = {
          nodes: Object.values(nodes),
          edges: Object.values(edges),
          groups: Object.values(groups),
          history,
          viewTransform,
          theme,
          shortcuts,
      };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(workflow, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "workflow.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
  }, [nodes, edges, groups, history, viewTransform, theme, shortcuts]);

  const uploadWorkflow = useCallback(() => {
      fileInputRef.current?.click();
  }, []);

  const handleOpenEditPromptModal = useCallback((nodeId: string) => {
    const nodeToEdit = nodes[nodeId];
    if (nodeToEdit) {
      setEditingPromptNode(nodeToEdit);
      setEditedPromptValue(nodeToEdit.data.prompt || '');
    }
  }, [nodes]);

  const handleSaveEditedPrompt = useCallback(() => {
    if (editingPromptNode) {
      updateNodeData(editingPromptNode.id, { prompt: editedPromptValue });
    }
    setEditingPromptNode(null);
  }, [editingPromptNode, editedPromptValue, updateNodeData]);
  
  const nodeRgba = useMemo(() => {
    const rgb = hexToRgb(theme.nodeBackground);
    const opacity = theme.nodeOpacity ?? DEFAULT_THEME.nodeOpacity;
    if (rgb) {
        return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
    // Fallback if the color is invalid, use default color with current opacity
    const defaultRgb = hexToRgb(DEFAULT_THEME.nodeBackground);
    return `rgba(${defaultRgb!.r}, ${defaultRgb!.g}, ${defaultRgb!.b}, ${opacity})`;
  }, [theme.nodeBackground, theme.nodeOpacity]);

  const canvasStyle = {
    '--node-background-color': nodeRgba,
    '--node-text-color': theme.nodeTextColor,
    '--uploader-text-color': theme.uploaderTextColor,
    backgroundColor: theme.canvasBackground,
    backgroundSize: '25px 25px',
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
    backgroundRepeat: 'repeat',
    backgroundPosition: '0 0',
  } as React.CSSProperties;

  if (theme.canvasBackgroundImage) {
    canvasStyle.backgroundImage = `url(${theme.canvasBackgroundImage}), ${canvasStyle.backgroundImage}`;
    canvasStyle.backgroundSize = `cover, 25px 25px`;
    canvasStyle.backgroundPosition = `center center, 0 0`;
    canvasStyle.backgroundRepeat = `no-repeat, repeat`;
  }
  
  return (
    <div className="flex w-screen h-screen overflow-hidden bg-black">
       {/* Toast Notification */}
       {notification && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium transition-all duration-300 ${
            notification.type === 'error' ? 'bg-red-500/90' : 
            notification.type === 'success' ? 'bg-green-500/90' : 
            notification.type === 'critical' ? 'bg-red-600 border-2 border-red-400' :
            'bg-blue-500/90'
        } backdrop-blur-md border border-white/20`}>
          {notification.message}
        </div>
      )}

      {!isAppMode && (
          <Sidebar 
            onAddNode={addNode} 
            isCollapsed={isNodeSidebarCollapsed}
            onToggle={() => setIsNodeSidebarCollapsed(p => !p)}
          />
      )}
      
      <div className="relative flex-grow h-full overflow-hidden">
        {isAppMode ? (
            <div className="flex flex-col w-full h-full" style={canvasStyle}>
                <div className="relative flex-grow overflow-auto">
                    <AppModeView 
                        nodes={nodes} 
                        updateNodeData={updateNodeData} 
                        theme={theme}
                    />
                </div>
                <div className="relative flex-shrink-0 p-4 flex justify-center bg-black/30 backdrop-blur-sm">
                    <button
                        onClick={runWorkflow}
                        disabled={isProcessing}
                        className="flex items-center px-8 py-3 font-bold text-white rounded-lg shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-105"
                        style={{ backgroundColor: isProcessing ? undefined : theme.buttonColor }}
                    >
                        {isProcessing ? (
                            <>
                                <div className="w-5 h-5 mr-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                                Processing...
                            </>
                        ) : (
                            <>
                                <PlayIcon className="w-6 h-6 mr-2" />
                                Run
                            </>
                        )}
                    </button>
                </div>
            </div>
        ) : (
            <div
                ref={canvasRef}
                className="relative flex-grow h-full overflow-hidden cursor-default"
                style={canvasStyle}
                onWheel={handleWheel}
                onMouseDown={handleCanvasMouseDown}
            >
                {selectionBoxDiv && (
                    <div 
                        className="absolute bg-blue-500/20 border border-blue-400 pointer-events-none z-30"
                        style={{ ...selectionBoxDiv }}
                    />
                )}
                <div
                    className="absolute top-0 left-0 w-full h-full"
                    style={{ 
                        transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
                        transformOrigin: '0 0'
                    }}
                >
                    {Object.values(groups).map(group => (
                        <GroupComponent 
                            key={group.id}
                            group={group}
                            nodes={nodes}
                            updateGroup={updateGroup}
                            onDelete={handleDeleteGroup}
                            onMouseDown={handleMouseDownGroup}
                        />
                    ))}
                    <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" style={{ width: '100%', height: '100%' }}>
                      {showEdges && Object.values(edges).map((edge: Edge) => {
                        const startPos = getHandlePosition(edge.sourceNodeId, edge.sourceHandleId);
                        const endPos = getHandlePosition(edge.targetNodeId, edge.targetHandleId);
                        const sourceNode = nodes[edge.sourceNodeId];
                        const sourceHandle = sourceNode?.data.outputs.find(o => o.id === edge.sourceHandleId);
                        const handleType = sourceHandle?.type || 'any';
                        
                        return <EdgeComponent 
                            key={edge.id} 
                            id={edge.id}
                            start={startPos} 
                            end={endPos} 
                            isSelected={selectedEdgeId === edge.id}
                            onClick={handleEdgeClick}
                            color={theme.edgeColors[handleType]}
                            width={theme.edgeWidth}
                        />;
                      })}

                      {showEdges && connectingEdge.current && connectingEdgeEnd && (
                          <EdgeComponent 
                              id="connecting-edge"
                              start={getHandlePosition(connectingEdge.current.sourceNodeId, connectingEdge.current.sourceHandleId)} 
                              end={connectingEdgeEnd} 
                              isSelected={false}
                              onClick={() => {}}
                              color={theme.edgeColors.any}
                              width={theme.edgeWidth}
                          />
                      )}
                    </svg>

                    {Object.values(nodes).sort((a: Node, b: Node) => (a.zIndex || 0) - (b.zIndex || 0)).map((node: Node) => (
                         <NodeComponent
                            key={node.id}
                            node={node}
                            isSelected={selectedNodeIds.has(node.id)}
                            onMouseDown={handleMouseDownNode}
                            onHandleMouseDown={handleMouseDownHandle}
                            onResizeMouseDown={handleResizeMouseDown}
                            updateNodeData={updateNodeData}
                            onEditPrompt={handleOpenEditPromptModal}
                            edgeColors={theme.edgeColors}
                         />
                    ))}
                </div>
              </div>
        )}

        <div className="absolute top-4 right-4 z-20 flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-gray-800/50 backdrop-blur-sm p-1 rounded-lg">
                 <button onClick={() => setIsHelpOpen(true)} title="Help & Guide" className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors font-bold">?</button>
                 <button onClick={() => setIsAppMode(p => !p)} title={isAppMode ? "Switch to Canvas Mode" : "Switch to App Mode"} className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors">
                    {isAppMode ? <CanvasViewIcon className="w-6 h-6" /> : <AppWindowIcon className="w-6 h-6"/>}
                </button>
                <button onClick={() => setIsSettingsPanelOpen(true)} title="Settings" className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors"><SettingsIcon className="w-6 h-6"/></button>
                {!isAppMode && (
                    <>
                        <button onClick={() => setShowEdges(p => !p)} title={showEdges ? "Hide Connections" : "Show Connections"} className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors">
                            {showEdges ? <EyeIcon className="w-6 h-6" /> : <EyeOffIcon className="w-6 h-6"/>}
                        </button>
                        <button onClick={downloadWorkflow} title="Save Workflow" className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors"><SaveIcon className="w-6 h-6"/></button>
                        <button onClick={uploadWorkflow} title="Load Workflow" className="p-2 text-white/80 hover:text-white hover:bg-gray-700/50 rounded-md transition-colors"><FolderOpenIcon className="w-6 h-6"/></button>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" style={{ display: 'none' }} />
                    </>
                )}
            </div>
            {!isAppMode && (
                <button
                    onClick={runWorkflow}
                    disabled={isProcessing}
                    className="flex items-center px-6 py-3 font-bold text-white rounded-lg shadow-lg disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:scale-105"
                    style={{ backgroundColor: isProcessing ? undefined : theme.buttonColor }}
                >
                    {isProcessing ? (
                        <>
                            <div className="w-5 h-5 mr-3 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                            Processing...
                        </>
                    ) : (
                        <>
                            <PlayIcon className="w-6 h-6 mr-2" />
                            Run Workflow
                        </>
                    )}
                </button>
            )}
        </div>
      </div>
      
      {!isAppMode && (
          <HistorySidebar 
            history={history} 
            onUseAsInput={addNodeFromHistory} 
            isCollapsed={isHistorySidebarCollapsed}
            onToggle={() => setIsHistorySidebarCollapsed(p => !p)}
            theme={theme}
          />
      )}

      {isSettingsPanelOpen && (
        <SettingsPanel
            theme={theme}
            setTheme={setTheme}
            shortcuts={shortcuts}
            setShortcuts={setShortcuts}
            onClose={() => setIsSettingsPanelOpen(false)}
            zoom={viewTransform.scale}
            onZoomChange={(newScale) => setViewTransform(v => ({...v, scale: newScale}))}
            aiConfig={aiConfig}
            setAiConfig={setAiConfig}
        />
      )}
      
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsHelpOpen(false)}>
            <div className="bg-neutral-800 rounded-lg shadow-xl w-full max-w-2xl p-6 text-white" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold">Workflow Guide</h2>
                    <button onClick={() => setIsHelpOpen(false)} className="text-gray-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
                    <section>
                        <h3 className="text-lg font-semibold text-sky-400 mb-2">Connecting Nodes</h3>
                        <p className="text-gray-300 mb-2">Nodes communicate by connecting outputs to inputs.</p>
                        <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                            <li><span className="text-white font-medium">Text Input Node:</span> Connects to 'Prompt' or 'Text' inputs.</li>
                            <li><span className="text-white font-medium">Image Input Node:</span> Connects to 'Image' inputs.</li>
                            <li><span className="text-white font-medium">Image Generator:</span> Requires a <span className="text-yellow-400">Text Prompt</span>. The Image input is optional (for editing).</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-lg font-semibold text-sky-400 mb-2">Common Errors</h3>
                        <ul className="list-disc list-inside text-gray-400 text-sm space-y-1">
                            <li><span className="text-red-400">"A text prompt is required..."</span>: You must connect a Text Input node to the 'Prompt' handle of the generator. connecting it to the Image handle will fail.</li>
                            <li><span className="text-red-400">"Missing required inputs"</span>: Ensure all necessary inputs for a Preset are connected.</li>
                        </ul>
                    </section>
                    
                     <section>
                        <h3 className="text-lg font-semibold text-sky-400 mb-2">Tips</h3>
                        <p className="text-gray-300 text-sm">
                            - Use the <span className="font-bold">Output Node</span> to visualize results large and clear.<br/>
                            - Generators also show a preview of their result upon completion.<br/>
                            - Check the notification bar at the top for error details.
                        </p>
                    </section>
                </div>
                
                <div className="mt-8 flex justify-end">
                    <button onClick={() => setIsHelpOpen(false)} className="px-4 py-2 bg-sky-600 rounded-md hover:bg-sky-700 text-white font-medium">Got it</button>
                </div>
            </div>
        </div>
      )}

      {editingPromptNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditingPromptNode(null)}>
          <div className="bg-neutral-800 rounded-lg shadow-xl w-full max-w-2xl p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 text-white">Edit Prompt for "{editingPromptNode.data.label}"</h3>
            <textarea
              className="w-full h-64 p-3 text-sm bg-neutral-900/80 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y text-white/90"
              value={editedPromptValue}
              onChange={(e) => setEditedPromptValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end mt-6 space-x-4">
              <button
                onClick={() => setEditingPromptNode(null)}
                className="px-4 py-2 text-sm font-semibold text-white bg-neutral-600 rounded-lg hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedPrompt}
                className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: theme.buttonColor }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
