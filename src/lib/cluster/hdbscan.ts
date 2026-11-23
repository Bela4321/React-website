// HDBSCAN (Campello, Moulavi & Sander 2013; McInnes et al. 2017) for a few hundred
// points, with the thesis' settings as defaults: min_cluster_size 5, min_samples 1,
// max_cluster_size 80, excess-of-mass selection.
//
// Besides the flat labels it returns the condensed cluster tree, which the page uses
// for the tree view and for "show me k clusters" cuts.

export interface ClusterNode {
  id: number;
  parent: number | null;
  children: number[];
  /** lambda (1 / distance) at which the cluster appears */
  birth: number;
  /** lambda at which it splits into child clusters (or its last point leaves) */
  death: number;
  stability: number;
  /** every point that is part of this cluster at its birth */
  points: number[];
}

export interface HdbscanResult {
  /** cluster node id per point in the default (EOM) selection, -1 = unclustered */
  labels: number[];
  /** the selected node ids, in tree order */
  selected: number[];
  nodes: Map<number, ClusterNode>;
  root: number;
}

export interface HdbscanOptions {
  minClusterSize?: number;
  minSamples?: number;
  maxClusterSize?: number;
}

const euclid = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
};

export function hdbscan(points: ArrayLike<number>[], opts: HdbscanOptions = {}): HdbscanResult {
  const n = points.length;
  const minClusterSize = opts.minClusterSize ?? 5;
  const minSamples = opts.minSamples ?? 1;
  const maxClusterSize = opts.maxClusterSize ?? Infinity;

  const nodes = new Map<number, ClusterNode>();
  if (n === 0) return { labels: [], selected: [], nodes, root: 0 };

  // 1. distances and core distances (distance to the minSamples-th neighbour, the point itself counting as the first)
  const dist = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) dist[i][j] = dist[j][i] = euclid(points[i], points[j]);
  const core = new Float64Array(n);
  if (minSamples > 1) {
    for (let i = 0; i < n; i++) {
      const sorted = Array.from(dist[i]).sort((a, b) => a - b);
      core[i] = sorted[Math.min(minSamples - 1, n - 1)];
    }
  }
  const mreach = (i: number, j: number) => Math.max(core[i], core[j], dist[i][j]);

  // 2. minimum spanning tree of the mutual reachability graph (Prim, O(n^2))
  const inTree = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const from = new Int32Array(n).fill(-1);
  const edges: [number, number, number][] = [];
  best[0] = 0;
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    inTree[u] = 1;
    if (from[u] >= 0) edges.push([from[u], u, best[u]]);
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = mreach(u, v);
      if (d < best[v]) {
        best[v] = d;
        from[v] = u;
      }
    }
  }
  edges.sort((a, b) => a[2] - b[2]);

  // 3. single-linkage dendrogram: leaves 0..n-1, merges n..2n-2
  const parentUF = Int32Array.from({ length: 2 * n - 1 }, (_, i) => i);
  const find = (x: number): number => {
    while (parentUF[x] !== x) x = parentUF[x] = parentUF[parentUF[x]];
    return x;
  };
  const left = new Int32Array(n - 1);
  const right = new Int32Array(n - 1);
  const height = new Float64Array(n - 1);
  const size = new Int32Array(2 * n - 1).fill(1);
  edges.forEach(([a, b, d], k) => {
    const ra = find(a);
    const rb = find(b);
    const m = n + k;
    left[k] = ra;
    right[k] = rb;
    height[k] = d;
    size[m] = size[ra] + size[rb];
    parentUF[ra] = parentUF[rb] = m;
  });
  const top = 2 * n - 2;

  const leavesOf = (node: number): number[] => {
    const out: number[] = [];
    const stack = [node];
    while (stack.length) {
      const x = stack.pop()!;
      if (x < n) out.push(x);
      else stack.push(left[x - n], right[x - n]);
    }
    return out;
  };
  const lambdaOf = (d: number) => (d > 0 ? 1 / d : Infinity);

  // 4. condensed tree: walk down from the top; a split counts only if both sides have >= minClusterSize points
  let nextId = 0;
  const pointLambda = new Float64Array(n); // lambda at which each point leaves its last cluster
  const pointCluster = new Int32Array(n); // that cluster
  const newNode = (parent: number | null, birth: number, members: number[]): ClusterNode => {
    const node: ClusterNode = { id: nextId++, parent, children: [], birth, death: birth, stability: 0, points: members };
    nodes.set(node.id, node);
    if (parent !== null) nodes.get(parent)!.children.push(node.id);
    return node;
  };
  const root = newNode(null, 0, leavesOf(top));

  // each work item: a dendrogram node that belongs to condensed cluster `c`
  const stack: [number, number][] = n > 1 ? [[top, root.id]] : [];
  if (n === 1) {
    pointLambda[0] = Infinity;
    pointCluster[0] = root.id;
  }
  while (stack.length) {
    const [dn, c] = stack.pop()!;
    const k = dn - n;
    const lam = lambdaOf(height[k]);
    const cl = nodes.get(c)!;
    const [a, b] = [left[k], right[k]];
    const big = (x: number) => size[x] >= minClusterSize;
    if (big(a) && big(b)) {
      cl.death = lam;
      for (const child of [a, b]) {
        const node = newNode(c, lam, leavesOf(child));
        if (child >= n) stack.push([child, node.id]);
        else {
          pointLambda[child] = Infinity;
          pointCluster[child] = node.id;
        }
      }
    } else {
      for (const child of [a, b]) {
        if (big(child)) {
          if (child >= n) stack.push([child, c]);
        } else {
          for (const p of leavesOf(child)) {
            pointLambda[p] = lam;
            pointCluster[p] = c;
          }
        }
      }
      cl.death = Math.max(cl.death, lam);
    }
  }

  // 5. stability: sum over points of (lambda_p - lambda_birth), where lambda_p is when the point
  //    leaves the cluster (or, for points passed on to child clusters, when the cluster splits)
  for (const node of nodes.values()) {
    if (node.parent === null) continue;
    let s = 0;
    for (const p of node.points) {
      const leaves = isDescendant(nodes, pointCluster[p], node.id) && pointCluster[p] !== node.id ? node.death : pointLambda[p];
      s += Math.min(leaves, finiteCap(node)) - node.birth;
    }
    node.stability = s;
  }

  // 6. excess of mass selection, bottom-up; the root is never a cluster, nor anything above maxClusterSize
  const selectedSet = new Set<number>();
  const order = [...nodes.values()].sort((x, y) => depth(nodes, y.id) - depth(nodes, x.id));
  const subtreeScore = new Map<number, number>();
  for (const node of order) {
    if (node.parent === null) continue;
    const childScore = node.children.reduce((s, c) => s + (subtreeScore.get(c) ?? 0), 0);
    const allowed = node.points.length <= maxClusterSize;
    if (node.children.length === 0 || (allowed && node.stability >= childScore)) {
      if (allowed || node.children.length === 0) {
        subtreeScore.set(node.id, node.stability);
        for (const d of descendants(nodes, node.id)) selectedSet.delete(d);
        selectedSet.add(node.id);
        continue;
      }
    }
    subtreeScore.set(node.id, childScore);
  }
  const selected = treeOrder(nodes, root.id).filter((id) => selectedSet.has(id));
  return { labels: labelsFor(nodes, selected, n), selected, nodes, root: root.id };
}

// --- cutting the tree -------------------------------------------------------------

/** Point labels for any set of (non-nested) cluster nodes; points outside all of them get -1. */
export function labelsFor(nodes: Map<number, ClusterNode>, shown: number[], n: number): number[] {
  const labels = new Array<number>(n).fill(-1);
  for (const id of shown) for (const p of nodes.get(id)!.points) labels[p] = id;
  return labels;
}

/**
 * The k-cluster view: start from the root and keep splitting the cluster that splits
 * first (lowest lambda, i.e. the largest distance) until there are k clusters or nothing
 * splits any more. k = 1 shows everything as one group.
 */
export function cutToK(nodes: Map<number, ClusterNode>, root: number, k: number): number[] {
  let shown = [root];
  while (shown.length < k) {
    const splittable = shown.filter((id) => nodes.get(id)!.children.length > 0);
    if (!splittable.length) break;
    const next = splittable.reduce((a, b) => (nodes.get(a)!.death <= nodes.get(b)!.death ? a : b));
    shown = shown.flatMap((id) => (id === next ? nodes.get(id)!.children : [id]));
  }
  return treeOrder(nodes, root).filter((id) => shown.includes(id));
}

/** How many clusters the tree can show at most (its leaves). */
export function maxClusters(nodes: Map<number, ClusterNode>): number {
  let leaves = 0;
  for (const node of nodes.values()) if (node.children.length === 0) leaves++;
  return leaves;
}

/** Replace one shown cluster by its children (a no-op for a leaf). */
export function splitNode(nodes: Map<number, ClusterNode>, root: number, shown: number[], id: number): number[] {
  const node = nodes.get(id)!;
  if (!node.children.length) return shown;
  const next = shown.flatMap((x) => (x === id ? node.children : [x]));
  return treeOrder(nodes, root).filter((x) => next.includes(x));
}

/** Merge a cluster back into its parent: the parent replaces every shown cluster below it. */
export function mergeNode(nodes: Map<number, ClusterNode>, root: number, shown: number[], id: number): number[] {
  const parent = nodes.get(id)!.parent;
  if (parent === null) return shown;
  const below = new Set(descendants(nodes, parent));
  const next = [...shown.filter((x) => !below.has(x)), parent];
  return treeOrder(nodes, root).filter((x) => next.includes(x));
}

// --- tree helpers -------------------------------------------------------------------

export function descendants(nodes: Map<number, ClusterNode>, id: number): number[] {
  const out: number[] = [];
  const stack = [...nodes.get(id)!.children];
  while (stack.length) {
    const x = stack.pop()!;
    out.push(x);
    stack.push(...nodes.get(x)!.children);
  }
  return out;
}

/** Depth-first order (children in creation order), so lists and colours stay stable. */
export function treeOrder(nodes: Map<number, ClusterNode>, root: number): number[] {
  const out: number[] = [];
  const visit = (id: number) => {
    out.push(id);
    for (const c of nodes.get(id)!.children) visit(c);
  };
  visit(root);
  return out;
}

function depth(nodes: Map<number, ClusterNode>, id: number): number {
  let d = 0;
  for (let p = nodes.get(id)!.parent; p !== null; p = nodes.get(p)!.parent) d++;
  return d;
}

function isDescendant(nodes: Map<number, ClusterNode>, id: number, ancestor: number): boolean {
  for (let x: number | null = id; x !== null; x = nodes.get(x)!.parent) if (x === ancestor) return true;
  return false;
}

/** Points that never leave (duplicates at distance 0) would give infinite stability; cap at the death lambda. */
function finiteCap(node: ClusterNode): number {
  return Number.isFinite(node.death) && node.death > node.birth ? Math.max(node.death, node.birth) : node.birth + 1;
}
