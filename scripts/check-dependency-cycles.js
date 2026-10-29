#!/usr/bin/env node
/**
 * Modül bağımlılık döngü kontrolü
 * docs/architecture/modules.md içindeki iki mermaid grafiğini parse eder:
 * 1. Modül bağımlılık grafiği
 * 2. ADIM geliştirme sırası grafiği (status.json ile karşılaştırılır)
 */

const fs = require('fs');
const path = require('path');

const MODULES_MD = path.join(__dirname, '../docs/architecture/modules.md');
const STATUS_JSON = path.join(__dirname, '../docs/handover/status.json');

console.log('=== Modül Bağımlılık Döngü Kontrolü ===\n');

// modules.md oku
if (!fs.existsSync(MODULES_MD)) {
  console.error(`❌ ${MODULES_MD} bulunamadı`);
  process.exit(1);
}

const content = fs.readFileSync(MODULES_MD, 'utf-8');

// Mermaid bloklarını çıkar
const mermaidBlocks = [];
const lines = content.split('\n');
let inMermaid = false;
let blockContent = [];
let blockStart = 0;

lines.forEach((line, idx) => {
  const lineNum = idx + 1;
  
  if (line.trim() === '```mermaid') {
    inMermaid = true;
    blockStart = lineNum;
    blockContent = [];
    return;
  }
  
  if (inMermaid) {
    if (line.trim() === '```') {
      mermaidBlocks.push({
        start: blockStart,
        content: blockContent.join('\n')
      });
      inMermaid = false;
    } else {
      blockContent.push(line);
    }
  }
});

if (mermaidBlocks.length === 0) {
  console.error(`❌ Hiç mermaid bloğu bulunamadı`);
  process.exit(1);
}

console.log(`Toplam ${mermaidBlocks.length} mermaid bloğu bulundu\n`);

// Her bloğu ayrı işle
const graphs = [];

mermaidBlocks.forEach((block, idx) => {
  const blockNum = idx + 1;
  const isStepGraph = block.content.includes('ADIM');
  const graphType = isStepGraph ? 'ADIM Sırası' : 'Modül Bağımlılıkları';
  
  console.log(`--- Graf ${blockNum}: ${graphType} (satır ${block.start}) ---`);
  
  // Kenarları parse et: A --> B veya A -.-> B
  const edges = [];
  const edgeRegex = /(\S+)\s*(-->|-\.->)\s*(\S+)/g;
  let match;
  
  while ((match = edgeRegex.exec(block.content)) !== null) {
    const from = match[1];
    const to = match[3];
    const edgeType = match[2];
    // Dotted edge (-.->): watch/wear bağımlılığı, döngü kontrolünde ignore
    if (edgeType === '-.->') {
      continue;
    }
    edges.push({ from, to });
  }
  
  // Düğümleri topla
  const nodes = new Set();
  edges.forEach(({ from, to }) => {
    nodes.add(from);
    nodes.add(to);
  });
  
  console.log(`Düğüm sayısı: ${nodes.size}`);
  console.log(`Kenar sayısı: ${edges.length} (dotted edges hariç)`);
  
  // Adjacency list oluştur
  const graph = {};
  nodes.forEach(node => {
    graph[node] = [];
  });
  edges.forEach(({ from, to }) => {
    graph[from].push(to);
  });
  
  // İlk 10 bağımlılığı göster
  console.log('\nBağımlılıklar (A --> B: B, A\'dan önce gelir / A, B\'ye bağımlıdır):');
  const sortedNodes = Object.keys(graph).sort();
  let count = 0;
  for (const node of sortedNodes) {
    if (graph[node].length > 0 && count < 10) {
      console.log(`  ${node} --> ${graph[node].join(', ')}`);
      count++;
    }
  }
  if (sortedNodes.length > 10) {
    console.log(`  ... (${sortedNodes.length - 10} daha)`);
  }
  
  // DFS ile döngü tespiti
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];
  
  function dfs(node, path = []) {
    if (recStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      cycles.push(cycle);
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recStack.add(node);
    path.push(node);
    
    for (const neighbor of graph[node]) {
      dfs(neighbor, [...path]);
    }
    
    recStack.delete(node);
    return false;
  }
  
  for (const node of nodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  
  console.log('\nDöngü kontrolü:');
  if (cycles.length > 0) {
    console.log(`❌ ${cycles.length} döngü bulundu:\n`);
    cycles.forEach((cycle, i) => {
      console.log(`  Döngü ${i + 1}: ${cycle.join(' → ')}`);
    });
  } else {
    console.log('✅ Döngü yok (grafik DAG)');
  }
  
  graphs.push({
    type: graphType,
    isStepGraph,
    edges,
    nodes,
    graph,
    cycles
  });
  
  console.log('');
});

// ADIM grafiğini status.json ile karşılaştır
const stepGraph = graphs.find(g => g.isStepGraph);

if (stepGraph) {
  console.log('--- ADIM Graf Doğrulama (status.json ile) ---');
  
  if (!fs.existsSync(STATUS_JSON)) {
    console.error(`❌ ${STATUS_JSON} bulunamadı`);
    process.exit(1);
  }
  
  const statusData = JSON.parse(fs.readFileSync(STATUS_JSON, 'utf-8'));
  
  // status.json'dan bağımlılıkları çıkar
  // ADIM X depends on [Y] => Y --> X (Y önce gelir, X sonra)
  const statusEdges = new Set();
  statusData.steps.forEach(step => {
    const stepId = `ADIM${step.id}`;
    (step.dependencies || []).forEach(depId => {
      const depStepId = `ADIM${depId.padStart(2, '0')}`;
      statusEdges.add(`${depStepId}-->${stepId}`);
    });
  });
  
  // Mermaid'deki ADIM kenarlarını çıkar
  const mermaidEdges = new Set();
  stepGraph.edges.forEach(({ from, to }) => {
    if (from.startsWith('ADIM') && to.startsWith('ADIM')) {
      mermaidEdges.add(`${from}-->${to}`);
    }
  });
  
  console.log(`status.json kenar sayısı: ${statusEdges.size}`);
  console.log(`mermaid ADIM kenar sayısı: ${mermaidEdges.size}`);
  
  // Farkları bul
  const missingInMermaid = [...statusEdges].filter(e => !mermaidEdges.has(e));
  const extraInMermaid = [...mermaidEdges].filter(e => !statusEdges.has(e));
  
  console.log(`\nstatus.json kenarlarından mermaid'de eksik: ${missingInMermaid.length}`);
  if (missingInMermaid.length > 0 && missingInMermaid.length <= 20) {
    console.log('İlk 20:');
    missingInMermaid.slice(0, 20).forEach(e => {
      const [from, to] = e.split('-->');
      console.log(`  ${from} --> ${to}`);
    });
    if (missingInMermaid.length > 20) {
      console.log(`  ... (${missingInMermaid.length - 20} daha)`);
    }
  }
  
  if (extraInMermaid.length > 0) {
    console.log('\n❌ HATA: mermaid\'de var ama status.json\'da yok:');
    extraInMermaid.forEach(e => {
      const [from, to] = e.split('-->');
      console.log(`  ${from} --> ${to}`);
    });
  }
  
  if (extraInMermaid.length === 0) {
    console.log('\n✅ ADIM grafiği status.json ile tutarlı (mermaid ⊆ status.json)');
    console.log('Not: status.json transitif bağımlılıklar içerebilir, bu normaldir.');
  } else {
    console.log('\n❌ ADIM grafiği status.json ile tutarsız');
  }
  
  console.log('');
}

// Toplu sonuç
const hasCycles = graphs.some(g => g.cycles.length > 0);
if (hasCycles) {
  console.log('=== SONUÇ: FAIL (döngü var) ===');
  process.exit(1);
} else {
  console.log('=== SONUÇ: PASS (döngü yok) ===');
  process.exit(0);
}
