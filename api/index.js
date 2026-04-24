const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const USER_ID = "suhanisingh_16012005";          
const EMAIL_ID = "ss9178@srmist.edu.in";  
const ROLL_NUMBER = "RA2311030020119";           

function isValid(entry) {
  const trimmed = entry.trim();
  if (!/^[A-Z]->[A-Z]$/.test(trimmed)) return false;
  const [p, c] = trimmed.split('->');
  return p !== c; 
}

function hasCycle(nodes, adjList) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = {};
  for (const n of nodes) color[n] = WHITE;

  function dfs(u) {
    color[u] = GRAY;
    for (const v of (adjList[u] || [])) {
      if (color[v] === GRAY) return true;
      if (color[v] === WHITE && dfs(v)) return true;
    }
    color[u] = BLACK;
    return false;
  }

  for (const n of nodes) {
    if (color[n] === WHITE && dfs(n)) return true;
  }
  return false;
}

function buildTree(node, adjList, visited = new Set()) {
  if (visited.has(node)) return {};
  visited.add(node);
  const children = {};
  for (const child of (adjList[node] || [])) {
    children[child] = buildTree(child, adjList, visited);
  }
  return children;
}

function computeDepth(node, tree) {
  const children = tree[node];
  if (!children || Object.keys(children).length === 0) return 1;
  let max = 0;
  for (const child of Object.keys(children)) {
    max = Math.max(max, computeDepth(child, children));
  }
  return 1 + max;
}


function process(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const validEdges = []; 

  for (const raw of data) {
    const entry = typeof raw === "string" ? raw.trim() : String(raw).trim();

    if (!isValid(entry)) {
      invalidEntries.push(raw); 
      continue;
    }

    if (seenEdges.has(entry)) {
      if (!duplicateEdges.includes(entry)) duplicateEdges.push(entry);
      continue;
    }

    seenEdges.add(entry);
    const [parent, child] = entry.split("->");
    validEdges.push([parent, child]);
  }

  const adjList = {}; 
  const parentOf = {};  

  for (const [parent, child] of validEdges) {
    if (parentOf[child] !== undefined) {
      continue;
    }
    parentOf[child] = parent;
    if (!adjList[parent]) adjList[parent] = [];
    adjList[parent].push(child);
  }

  const allNodes = new Set();
  for (const [p, c] of validEdges) {
    allNodes.add(p);
    allNodes.add(c);
  }

  const undirected = {};
  for (const n of allNodes) undirected[n] = new Set();
  for (const [p, c] of validEdges) {
    undirected[p].add(c);
    undirected[c].add(p);
  }

  const visited = new Set();
  const components = [];

  for (const node of [...allNodes].sort()) {
    if (visited.has(node)) continue;
    const group = [];
    const queue = [node];
    while (queue.length) {
      const cur = queue.shift();
      if (visited.has(cur)) continue;
      visited.add(cur);
      group.push(cur);
      for (const nb of undirected[cur]) queue.push(nb);
    }
    components.push(group);
  }

  const hierarchies = [];

  for (const group of components) {
    const groupSet = new Set(group);

    const localAdj = {};
    for (const n of group) {
      localAdj[n] = (adjList[n] || []).filter(c => groupSet.has(c));
    }

    const cycleFound = hasCycle(group, localAdj);

    if (cycleFound) {
      const root = [...group].sort()[0];
      hierarchies.push({ root, tree: {}, has_cycle: true });
    } else {
      const childNodes = new Set(Object.keys(parentOf).filter(c => groupSet.has(c)));
      const roots = group.filter(n => !childNodes.has(n)).sort();
      const root = roots[0] || [...group].sort()[0];

      const rawTree = buildTree(root, localAdj);
      const wrappedTree = { [root]: rawTree };
      const depth = computeDepth(root, wrappedTree);

      hierarchies.push({ root, tree: wrappedTree, depth });
    }
  }

  const nonCyclic = hierarchies.filter(h => !h.has_cycle);
  const cyclic = hierarchies.filter(h => h.has_cycle);

  let largestRoot = "";
  let maxDepth = -1;
  for (const h of nonCyclic) {
    if (
      h.depth > maxDepth ||
      (h.depth === maxDepth && h.root < largestRoot)
    ) {
      maxDepth = h.depth;
      largestRoot = h.root;
    }
  }

  return {
    user_id: USER_ID,
    email_id: EMAIL_ID,
    college_roll_number: ROLL_NUMBER,
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: nonCyclic.length,
      total_cycles: cyclic.length,
      largest_tree_root: largestRoot,
    },
  };
}

app.post("/bfhl", (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data)) {
      return res.status(400).json({ error: "data must be an array" });
    }
    const result = process(data);
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/", (req, res) => res.json({ status: "ok", route: "POST /bfhl" }));

const PORT = (typeof process !== 'undefined' && process.env && process.env.PORT) ? process.env.PORT : 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));

module.exports = app;
