#!/usr/bin/env node
/**
 * Modül bağımlılık döngü kontrolü
 * docs/architecture/modules.md içindeki mermaid bloğundan bağımlılıkları parse eder
 * DFS ile döngü tespiti yapar
 */

const fs = require('fs');
const path = require('path');

const MODULES_MD = path.join(__dirname, '../docs/architecture/modules.md');

console.log('=== Modül Bağımlılık Döngü Kontrolü ===\n');

// modules.md oku
if (!fs.existsSync(MODULES_MD)) {
  console.error(`❌ ${MODULES_MD} bulunamadı`);
  process.exit(1);
}

const content = fs.readFileSync(MODULES_MD, 'utf-8');

// Mermaid bloklarını çıkar
const mermaidBlocks = [];
const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
let match;

while ((match = mermaidRegex.exec(content)) !== null) {
  mermaidBlocks.push(match[1]);
}

if (mermaidBlocks.length === 0) {
  console.error('❌ modules.md içinde mermaid bloğu bulunamadı');
  process.exit(1);
}

// Bağımlılık grafiği için ilk mermaid bloğunu kullan (modül grafiği)
// İkinci blok ADIM sırası grafiği olabilir, dependency graph olanı bulalım
let dependencyGraph = null;
for (const block of mermaidBlocks) {
  // "graph TD" ve "-->" içeren bloğu bul
  if (block.includes('graph TD') && block.includes('-->')) {
    dependencyGraph = block;
    break;
  }
}

if (!dependencyGraph) {
  console.error('❌ Bağımlılık grafiği içeren mermaid bloğu bulunamadı (graph TD + -->)');
  process.exit(1);
}

// Kenarları parse et: A --> B
const edges = [];
const edgeRegex = /(\S+)\s*-->\s*(\S+)/g;

while ((match = edgeRegex.exec(dependencyGraph)) !== null) {
  const from = match[1];
  const to = match[2];
  edges.push({ from, to });
}

if (edges.length === 0) {
  console.error('❌ Bağımlılık kenarı bulunamadı');
  process.exit(1);
}

// Düğümleri topla
const nodes = new Set();
edges.forEach(({ from, to }) => {
  nodes.add(from);
  nodes.add(to);
});

console.log(`Düğüm sayısı: ${nodes.size}`);
console.log(`Kenar sayısı: ${edges.length}`);
console.log('');

// Adjacency list oluştur
const graph = {};
nodes.forEach(node => {
  graph[node] = [];
});
edges.forEach(({ from, to }) => {
  graph[from].push(to);
});

console.log('Bağımlılıklar (A → B: A depends on B):');
Object.keys(graph).sort().forEach(node => {
  if (graph[node].length > 0) {
    console.log(`  ${node} → ${graph[node].join(', ')}`);
  }
});
console.log('');

// DFS ile döngü tespiti
function detectCycle() {
  const visited = new Set();
  const recStack = new Set();
  const cycles = [];

  function dfs(node, path = []) {
    if (recStack.has(node)) {
      // Döngü bulundu
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

  return cycles;
}

console.log('Döngü kontrolü:');
const cycles = detectCycle();

if (cycles.length > 0) {
  console.log(`❌ ${cycles.length} döngü bulundu:\n`);
  cycles.forEach((cycle, idx) => {
    console.log(`  Döngü ${idx + 1}: ${cycle.join(' → ')}`);
  });
  process.exit(1);
} else {
  console.log('✅ Döngü yok (grafik DAG)');
  process.exit(0);
}
