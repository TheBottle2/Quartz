import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { readFile } from '../api';
import { createT, type Lang } from '../i18n';
import { Icon } from './Icon';
import styles from './GraphModal.module.css';

interface GraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: string[];
  onNoteOpen: (noteName: string) => void;
  searchQuery?: string;
  lang: Lang;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  group: 'note' | 'tag' | 'folder';
  label: string;
  type: 'note' | 'tag' | 'folder';
  folder?: string;
  tags?: string[];
  size: number;
  color: string;
  date?: string;
  highlighted?: boolean;
  // d3 simulation properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  type: 'backlink' | 'tag' | 'folder';
}

type FilterType = 'all' | 'notes' | 'tags' | 'folders';

// Helper to get endpoint ID from link (handles d3 converting strings to objects)
const endpointId = (v: string | GraphNode): string =>
  typeof v === 'object' && v !== null ? v.id : (v as string);

export const GraphModal: React.FC<GraphModalProps> = ({
  isOpen,
  onClose,
  files,
  onNoteOpen,
  searchQuery = '',
  lang,
}) => {
  const t = createT(lang);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
  const renderMinimapRef = useRef<() => void>(() => {});
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [filteredData, setFilteredData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterFolder, setFilterFolder] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const transformRef = useRef<d3.ZoomTransform | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Ref mirrors so d3 event handlers (registered once per render) never go stale
  // and selecting a node doesn't restart the whole simulation.
  const onNoteOpenRef = useRef(onNoteOpen);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onNoteOpenRef.current = onNoteOpen; }, [onNoteOpen]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Render minimap - defined before useEffect that references it
  const renderMinimap = useCallback(() => {
    if (!minimapRef.current || !svgRef.current) return;

    const minimap = d3.select(minimapRef.current);
    minimap.selectAll('*').remove();

    const width = 200;
    const height = 150;
    const mainSvg = svgRef.current;
    const mainRect = mainSvg.getBoundingClientRect();

    // Calculate bounds of all nodes
    const nodes = filteredData.nodes;
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((d: any) => {
      if (d.x !== undefined && d.y !== undefined) {
        minX = Math.min(minX, d.x);
        minY = Math.min(minY, d.y);
        maxX = Math.max(maxX, d.x);
        maxY = Math.max(maxY, d.y);
      }
    });

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const scale = Math.min(width / rangeX, height / rangeY) * 0.8;

    const transformMap = `translate(${width/2 - (minX + maxX)/2 * scale}, ${height/2 - (minY + maxY)/2 * scale}) scale(${scale})`;

    // Draw nodes on minimap
    minimap.append('g')
      .attr('transform', transformMap)
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('cx', (d: any) => d.x || 0)
      .attr('cy', (d: any) => d.y || 0)
      .attr('r', 2)
      .attr('fill', (d: any) => d.color)
      .attr('opacity', 0.7);

    // Draw viewport rectangle
    const tr = transformRef.current;
    const viewportScale = 1 / (tr?.k || 1);
    const viewportWidth = mainRect.width * viewportScale;
    const viewportHeight = mainRect.height * viewportScale;
    const viewportX = -(tr?.x || 0) * viewportScale;
    const viewportY = -(tr?.y || 0) * viewportScale;

    minimap.append('g')
      .attr('transform', transformMap)
      .append('rect')
      .attr('x', viewportX)
      .attr('y', viewportY)
      .attr('width', viewportWidth)
      .attr('height', viewportHeight)
      .attr('fill', 'none')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2 / scale)
      .attr('stroke-dasharray', '4,4');

  }, [filteredData]);

  useEffect(() => {
    renderMinimapRef.current = renderMinimap;
  }, [renderMinimap]);

  // Build graph data
  const buildGraphData = useCallback(async () => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const tagsSet = new Set<string>();
    const foldersSet = new Set<string>();

    const results = await Promise.all(
      files.filter(f => f !== 'index.md').map(async (fileName) => {
        try {
          return { fileName, content: await readFile(fileName) };
        } catch (error) {
          console.error(`Error processing file ${fileName}:`, error);
          return null;
        }
      })
    );

    for (const item of results) {
      if (!item) continue;
      const { fileName, content } = item;
      const noteName = fileName.replace(/\.md$/, '');

      // Extract folder
      const folder = noteName.includes('/') ? noteName.split('/')[0] : 'root';
      foldersSet.add(folder);

      // Extract tags from #tag syntax
      const tags: string[] = [];
      const tagMatches = content.match(/(?:^|\s)#([\w-]+)/g) || [];
      tagMatches.forEach(tag => {
        const cleanTag = tag.replace(/^#/, '').trim();
        if (cleanTag) {
          tags.push(cleanTag);
          tagsSet.add(cleanTag);
        }
      });

      // Extract date for sorting
      let date = '';
      const dateMatch = content.match(/date:\s*(\d{4}-\d{2}-\d{2})/i);
      if (dateMatch) {
        date = dateMatch[1];
      }

      // Add note node
      nodes.push({
        id: noteName,
        group: 'note',
        label: noteName.split('/').pop() || noteName,
        type: 'note',
        folder,
        tags,
        size: 1,
        color: '#4A9EFF',
        date,
      });

      // Extract wiki-links
      const linkMatches = content.match(/\[\[([^\]]+)\]\]/g) || [];
      linkMatches.forEach(link => {
        const target = link.replace(/\[\[|\]\]/g, '').trim();
        if (target !== noteName && files.includes(target + '.md')) {
          links.push({
            source: noteName,
            target,
            type: 'backlink',
          });
        }
      });

      // Add tag nodes and links
      tags.forEach(tag => {
        const tagId = `tag:${tag}`;
        if (!nodes.find(n => n.id === tagId)) {
          nodes.push({
            id: tagId,
            group: 'tag',
            label: `#${tag}`,
            type: 'tag',
            size: 0.5,
            color: '#FF6B6B',
          });
        }
        links.push({
          source: tagId,
          target: noteName,
          type: 'tag',
        });
      });
    }

    // Add folder nodes and links
    foldersSet.forEach(folder => {
      const folderId = `folder:${folder}`;
      if (!nodes.find(n => n.id === folderId)) {
        nodes.push({
          id: folderId,
          group: 'folder',
          label: folder === 'root' ? '📁 Root' : `📁 ${folder}`,
          type: 'folder',
          size: 0.3,
          color: '#51CF66',
        });
      }

      // Link folder to its notes
      nodes
        .filter(n => n.type === 'note' && n.folder === folder)
        .forEach(note => {
          links.push({
            source: folderId,
            target: note.id,
            type: 'folder',
          });
        });
    });

    setAvailableTags(Array.from(tagsSet));
    setAvailableFolders(Array.from(foldersSet));
    setGraphData({ nodes, links });
    setFilteredData({ nodes, links });
  }, [files]);

  // Filter data
  const applyFilters = useCallback(() => {
    let filteredNodes = [...graphData.nodes];
    let filteredLinks = [...graphData.links];
    // Drop links whose endpoints no longer exist (d3 forceLink + rendering
    // both break on dangling references).
    const keepLinksFor = (nodes: GraphNode[]) => {
      const ids = new Set(nodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        ids.has(endpointId(link.source)) && ids.has(endpointId(link.target))
      );
    };

    // Filter by type
    if (filterType !== 'all') {
      filteredNodes = filteredNodes.filter(node => {
        if (filterType === 'notes') return node.type === 'note';
        if (filterType === 'tags') return node.type === 'tag';
        if (filterType === 'folders') return node.type === 'folder';
        return true;
      });
      keepLinksFor(filteredNodes);
    }

    // Filter by tags
    if (filterTags.length > 0) {
      const tagIds = filterTags.map(t => `tag:${t}`);
      filteredNodes = filteredNodes.filter(node =>
        node.type === 'tag' ? tagIds.includes(node.id) :
        node.tags?.some(t => filterTags.includes(t))
      );

      // Keep links between filtered nodes
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        filteredNodeIds.has(endpointId(link.source)) && filteredNodeIds.has(endpointId(link.target))
      );
    }

    // Filter by folder
    if (filterFolder) {
      filteredNodes = filteredNodes.filter(node =>
        node.type === 'folder' ? node.id === `folder:${filterFolder}` :
        node.folder === filterFolder
      );

      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        filteredNodeIds.has(endpointId(link.source)) && filteredNodeIds.has(endpointId(link.target))
      );
    }

    // Filter by date range
    if (dateRange.start && dateRange.end) {
      filteredNodes = filteredNodes.filter(node => {
        if (node.type !== 'note' || !node.date) return true;
        return node.date >= dateRange.start && node.date <= dateRange.end;
      });

      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      filteredLinks = filteredLinks.filter(link =>
        filteredNodeIds.has(endpointId(link.source)) && filteredNodeIds.has(endpointId(link.target))
      );
    }

    // Apply search highlight
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredNodes = filteredNodes.map(node => ({
        ...node,
        highlighted: node.label.toLowerCase().includes(query) ||
                     node.id.toLowerCase().includes(query) ||
                     node.tags?.some(t => t.toLowerCase().includes(query))
      }));
    }

    setFilteredData({ nodes: filteredNodes, links: filteredLinks });
  }, [graphData, filterType, filterTags, filterFolder, dateRange, searchQuery]);

  // Render graph with D3
  const renderGraph = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    svg.selectAll('*').remove();

    if (filteredData.nodes.length === 0) {
      simulationRef.current?.stop();
      simulationRef.current = null;
      return;
    }

    // Add zoom behavior (kept in a ref so resetGraph can reuse it)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .extent([[0, 0], [width, height]])
      .scaleExtent([0.1, 3])
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        transformRef.current = event.transform;
        const tr = event.transform;
        svg.select('.graph-group').attr('transform', `translate(${tr.x},${tr.y}) scale(${tr.k})`);
        renderMinimapRef.current();
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    if (transformRef.current) {
      svg.call(zoom.transform, transformRef.current);
    }

    // Click on empty canvas clears the selection highlight
    svg.on('click', () => {
      setSelectedNode(null);
      svg.selectAll<SVGGElement, GraphNode>('.nodes > g').select('circle')
        .attr('stroke', 'none')
        .attr('opacity', (n: GraphNode) => n.highlighted ? 1 : 0.8);
      svg.selectAll<SVGLineElement, GraphLink>('.links line').attr('stroke-opacity', 0.3);
    });

    const g = svg.append('g').attr('class', 'graph-group');

    // Stop previous simulation
    simulationRef.current?.stop();

    // IMPORTANT: d3 mutates link objects (resolves string endpoints to node
    // refs and writes x/y). Work on copies AND bind those same copies to the
    // rendered <line> elements — binding the originals leaves string
    // endpoints, so every line collapses to (0,0) and links never appear.
    const simLinks: GraphLink[] = filteredData.links.map(l => ({ ...l }));
    const simulation = d3.forceSimulation<GraphNode>(filteredData.nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(simLinks)
        .id((d: GraphNode) => d.id)
        .distance((d: GraphLink) => {
          if (d.type === 'backlink') return 80;
          if (d.type === 'tag') return 60;
          return 50;
        })
        .strength((d: GraphLink) => {
          if (d.type === 'backlink') return 1;
          if (d.type === 'tag') return 0.8;
          return 0.5;
        })
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength((d: GraphNode) => {
          if (d.type === 'note') return -300;
          if (d.type === 'tag') return -100;
          return -50;
        })
        .distanceMin(10)
        .distanceMax(500)
      )
      .force('collision', d3.forceCollide<GraphNode>()
        .radius((d: GraphNode) => {
          if (d.type === 'note') return 25;
          if (d.type === 'tag') return 15;
          return 10;
        })
        .strength(0.5)
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.1);

    simulationRef.current = simulation;

    // Draw links (bound to the same simLinks objects the simulation mutates,
    // so endpoint x/y are available on every tick)
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(simLinks)
      .enter()
      .append('line')
      .attr('stroke', (d: GraphLink) => {
        if (d.type === 'backlink') return '#4A9EFF';
        if (d.type === 'tag') return '#FF6B6B';
        return '#51CF66';
      })
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', (d: GraphLink) => d.type === 'backlink' ? 2 : 1);

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(filteredData.nodes)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, unknown>, d: GraphNode) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    // Node circles
    node.append('circle')
      .attr('r', (d: GraphNode) => {
        if (d.type === 'note') return 20 + (d.size || 0) * 5;
        if (d.type === 'tag') return 12;
        return 8;
      })
      .attr('fill', (d: GraphNode) => d.highlighted ? '#FFD93D' : d.color)
      .attr('stroke', (d: GraphNode) => selectedNode === d.id ? '#fff' : 'none')
      .attr('stroke-width', 3)
      .attr('opacity', (d: GraphNode) => d.highlighted ? 1 : 0.8)
      .style('cursor', 'pointer');

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: GraphNode) => {
        if (d.type === 'note') return 30;
        if (d.type === 'tag') return 20;
        return 15;
      })
      .style('font-size', (d: GraphNode) => {
        if (d.type === 'note') return '11px';
        if (d.type === 'tag') return '9px';
        return '8px';
      })
      .style('fill', '#fff')
      .style('font-family', 'var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 1px 3px rgba(0,0,0,0.5)')
      .style('user-select', 'none')
      .text((d: GraphNode) => d.label);

    // Tooltips
    node.append('title')
      .text((d: GraphNode) => {
        let info = `${d.label}\nType: ${d.type}`;
        if (d.type === 'note') {
          info += `\nFolder: ${d.folder || 'root'}`;
          if (d.tags && d.tags.length > 0) {
            info += `\nTags: ${d.tags.join(', ')}`;
          }
          if (d.date) {
            info += `\nDate: ${d.date}`;
          }
        }
        return info;
      });

    // Single click = select + highlight neighbourhood (works for every node
    // type). Double-click on a note = open it and close the modal.
    const highlightNeighbourhood = (id: string) => {
      const connected = new Set<string>();
      simLinks.forEach(l => {
        const s = endpointId(l.source);
        const tg = endpointId(l.target);
        if (s === id) connected.add(tg);
        if (tg === id) connected.add(s);
      });

      node.select('circle')
        .attr('stroke', (n: GraphNode) => n.id === id ? '#fff' : 'none')
        .attr('opacity', (n: GraphNode) => {
          if (n.id === id) return 1;
          if (connected.has(n.id)) return 0.8;
          return 0.2;
        });

      link.attr('stroke-opacity', (l: GraphLink) =>
        endpointId(l.source) === id || endpointId(l.target) === id ? 0.8 : 0.05
      );
    };

    node.on('click', (event: unknown, d: GraphNode) => {
      (event as { stopPropagation?: () => void }).stopPropagation?.();
      setSelectedNode(d.id);

      if (d.type === 'note') {
        highlightNeighbourhood(d.id);
      } else if (d.type === 'tag') {
        // Filter by tag
        const tag = d.label.replace('#', '');
        setFilterTags([tag]);
      } else if (d.type === 'folder') {
        // Filter by folder
        const folder = d.label.replace('📁 ', '').replace(' Root', '');
        setFilterFolder(folder === 'Root' ? 'root' : folder);
      }
    });

    node.on('dblclick', (event: unknown, d: GraphNode) => {
      (event as { stopPropagation?: () => void }).stopPropagation?.();
      if (d.type === 'note') {
        onNoteOpenRef.current(d.id);
        onCloseRef.current();
      }
    });

    // Update positions on simulation tick
    let tickCount = 0;
    simulation.on('tick', () => {
      link
        .attr('x1', (d: GraphLink) => (d.source as unknown as GraphNode).x ?? 0)
        .attr('y1', (d: GraphLink) => (d.source as unknown as GraphNode).y ?? 0)
        .attr('x2', (d: GraphLink) => (d.target as unknown as GraphNode).x ?? 0)
        .attr('y2', (d: GraphLink) => (d.target as unknown as GraphNode).y ?? 0);

      node.attr('transform', (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);

      if (++tickCount % 10 === 0) {
        renderMinimapRef.current();
      }
    });

    simulation.alpha(0.3).restart();

    // Render minimap
    if (showMinimap && minimapRef.current) {
      renderMinimap();
    }
    // NOTE: selectedNode / callbacks intentionally excluded from deps —
    // selection is applied imperatively (no simulation restart), and d3
    // handlers use ref mirrors. Re-render only on data or minimap change.
  }, [filteredData, showMinimap]);

  // Export graph (SVG uses explicit dimensions + solid background so the
  // file doesn't depend on app CSS variables; PNG is rendered on an opaque
  // canvas at 2x for readability)
  const EXPORT_BG = '#1a1a1a';
  const exportGraph = useCallback(async (format: 'svg' | 'png') => {
    if (!svgRef.current) return;

    try {
      setIsExporting(true);
      const src = svgRef.current;
      const width = src.clientWidth || 800;
      const height = src.clientHeight || 600;

      const clone = src.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', String(width));
      clone.setAttribute('height', String(height));
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', EXPORT_BG);
      clone.insertBefore(bg, clone.firstChild);
      const svgData = new XMLSerializer().serializeToString(clone);

      if (format === 'svg') {
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `graph-${new Date().toISOString().slice(0, 10)}.svg`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // PNG export using canvas
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width * scale));
        canvas.height = Math.max(1, Math.floor(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = EXPORT_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            canvas.toBlob((blob) => {
              if (blob) {
                const link = document.createElement('a');
                const pngUrl = URL.createObjectURL(blob);
                link.href = pngUrl;
                link.download = `graph-${new Date().toISOString().slice(0, 10)}.png`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
              }
              resolve();
            });
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('graph png export failed'));
          };
          img.src = url;
        });
      }
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  }, []);

  // Reset graph (filters, selection, and zoom — via the stored behavior)
  const resetGraph = useCallback(() => {
    setFilterType('all');
    setFilterTags([]);
    setFilterFolder('');
    setDateRange({ start: '', end: '' });
    setSelectedNode(null);
    transformRef.current = null;

    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).call(
        zoomRef.current.transform as unknown as (
          selection: d3.Selection<SVGSVGElement, unknown, null, undefined>,
          transform: d3.ZoomTransform
        ) => void,
        d3.zoomIdentity
      );
    }
  }, []);

  // Initialize graph
  useEffect(() => {
    if (isOpen) {
      buildGraphData();
    }
  }, [isOpen, buildGraphData]);

  useEffect(() => {
    if (isOpen && graphData.nodes.length > 0) {
      applyFilters();
    }
  }, [isOpen, graphData, filterType, filterTags, filterFolder, dateRange, searchQuery]);

  useEffect(() => {
    if (isOpen && filteredData.nodes.length > 0) {
      renderGraph();
    }
  }, [isOpen, filteredData, renderGraph]);

  // Unmount cleanup
  useEffect(() => () => {
    simulationRef.current?.stop();
  }, []);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} ref={containerRef}>
        <div className={styles.modalHeader}>
          <h2>{t('graphTitle')}</h2>
          <div className={styles.headerControls}>
            <button
              className={styles.controlButton}
              onClick={() => setShowMinimap(!showMinimap)}
              aria-label={t('toggleMinimap')}
              title={t('toggleMinimap')}
              aria-pressed={showMinimap}
            >
              <Icon name={showMinimap ? 'eye' : 'eye-off'} size={16} />
            </button>
            <button
              className={styles.controlButton}
              onClick={() => exportGraph('svg')}
              disabled={isExporting}
              aria-label={t('exportSVG')}
              title={t('exportSVG')}
            >
              <Icon name="code" size={16} />
            </button>
            <button
              className={styles.controlButton}
              onClick={() => exportGraph('png')}
              disabled={isExporting}
              aria-label={t('exportPNG')}
              title={t('exportPNG')}
            >
              <Icon name="camera" size={16} />
            </button>
            <button
              className={styles.controlButton}
              onClick={resetGraph}
              aria-label={t('reset')}
              title={t('reset')}
            >
              <Icon name="refresh" size={16} />
            </button>
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label={t('closeGraph')}
              title={t('closeGraph')}
            >
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className={styles.filterPanel}>
          <div className={styles.filterGroup}>
            <label>{t('filterType')}</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className={styles.filterSelect}
            >
              <option value="all">{t('filterAll')}</option>
              <option value="notes">{t('filterNotes')}</option>
              <option value="tags">{t('filterTags')}</option>
              <option value="folders">{t('filterFolders')}</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>{t('filterTagsLabel')}</label>
            <select
              multiple
              value={filterTags}
              onChange={(e) => {
                const options = Array.from(e.target.selectedOptions, option => option.value);
                setFilterTags(options);
              }}
              className={styles.filterSelect}
              size={2}
            >
              {availableTags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>{t('filterFolder')}</label>
            <select
              value={filterFolder}
              onChange={(e) => setFilterFolder(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">{t('allFolders')}</option>
              {availableFolders.map(folder => (
                <option key={folder} value={folder}>
                  {folder === 'root' ? '📁 Root' : `📁 ${folder}`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label>{t('dateRange')}</label>
            <div className={styles.dateRange}>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className={styles.dateInput}
              />
              <span>→</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className={styles.dateInput}
              />
            </div>
          </div>

          <div className={styles.stats}>
            <span>
              {t('nodesCount', { count: String(filteredData.nodes.length) })}
            </span>
            <span>
              {t('linksCount', { count: String(filteredData.links.length) })}
            </span>
          </div>
        </div>

        <div className={styles.graphContainer}>
          <svg
            ref={svgRef}
            className={styles.graphSvg}
            width="100%"
            height="100%"
          />
          {filteredData.nodes.length === 0 && (
            <div className={styles.emptyState}>{t('graphEmpty')}</div>
          )}
          {showMinimap && (
            <div className={styles.minimapContainer}>
              <svg
                ref={minimapRef}
                className={styles.minimapSvg}
                width="200"
                height="150"
                viewBox="0 0 200 150"
              />
            </div>
          )}
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: '#4A9EFF' }} />
            <span>{t('legendNotes')}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: '#FF6B6B' }} />
            <span>{t('legendTags')}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: '#51CF66' }} />
            <span>{t('legendFolders')}</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendColor} style={{ background: '#FFD93D' }} />
            <span>{t('legendHighlight')}</span>
          </div>
          <div className={styles.legendHelp}>
            <span>{t('clickHint')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphModal;