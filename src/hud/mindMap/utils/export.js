import { toPng, toSvg } from 'html-to-image';
import { buildMindMapJson } from './mindMapData';

export const buildMarkdown = (nodes, edges) => {
  const childrenMap = {};
  edges.forEach(edge => {
    if (!childrenMap[edge.source]) {
      childrenMap[edge.source] = [];
    }
    childrenMap[edge.source].push(edge.target);
  });

  const isTarget = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !isTarget.has(n.id));

  const nodeMap = {};
  nodes.forEach(n => {
    nodeMap[n.id] = n;
  });

  let mdContent = '# Mapa Mental\n\n';

  const traverse = (nodeId, depth) => {
    const node = nodeMap[nodeId];
    if (!node) return;

    const indent = '  '.repeat(depth);
    const text = node.data?.label ? node.data.label.replace(/\n/g, ' ') : 'Módulo vazio';
    mdContent += `${indent}- ${text}\n`;

    if (childrenMap[nodeId]) {
      childrenMap[nodeId].forEach(childId => traverse(childId, depth + 1));
    }
  };

  rootNodes.forEach(root => traverse(root.id, 0));

  return mdContent;
};

export const exportToImage = async (format = 'png') => {
  const element = document.querySelector('.react-flow');
  if (!element) return;

  try {
    const fn = format === 'svg' ? toSvg : toPng;

    const filter = (node) => {
      const exclusionClasses = ['react-flow__panel', 'react-flow__controls', 'tools-panel'];
      return !(node?.classList && exclusionClasses.some(cls => node.classList.contains(cls)));
    };

    const dataUrl = await fn(element, {
      backgroundColor: '#0f111a',
      quality: 1,
      pixelRatio: 2,
      filter,
    });

    const link = document.createElement('a');
    link.download = `mapa-mental.${format}`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Falha ao exportar imagem:', error);
    alert('Erro ao exportar o mapa mental. Verifique o console.');
  }
};

export const exportToMarkdown = (nodes, edges) => {
  const mdContent = buildMarkdown(nodes, edges);
  const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', 'mapa-mental.md');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJson = (nodes, edges) => {
  const jsonContent = buildMindMapJson(nodes, edges);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', 'mapa-mental.json');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
