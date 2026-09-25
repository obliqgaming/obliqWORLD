// Pathfinding minimal par graphe de visibilité, pour un unique polygone
// (notre walkable_zone). Principe : si la ligne droite entre deux points reste
// entièrement dans le polygone, on l'utilise telle quelle (cas le plus courant,
// aucun calcul en plus). Sinon, on construit un graphe où les nœuds sont le
// départ, l'arrivée et les sommets du polygone, on relie deux nœuds s'ils se
// "voient" (segment entièrement dans la zone), puis on cherche le plus court
// chemin (Dijkstra). Ça évite de traverser un mur/obstacle en coupant tout
// droit à travers une zone non marchable en forme de L ou de U.

export type Pt = { x: number; y: number };

function pointsEqual(a: Pt, b: Pt, eps = 1e-6): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

function ccw(a: Pt, b: Pt, c: Pt): number {
  return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = ccw(p3, p4, p1);
  const d2 = ccw(p3, p4, p2);
  const d3 = ccw(p1, p2, p3);
  const d4 = ccw(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentInsidePolygon(a: Pt, b: Pt, polygon: Pt[]): boolean {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const e1 = polygon[i];
    const e2 = polygon[(i + 1) % n];
    if (pointsEqual(a, e1) || pointsEqual(a, e2) || pointsEqual(b, e1) || pointsEqual(b, e2)) continue;
    if (segmentsIntersect(a, b, e1, e2)) return false;
  }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return pointInPolygon(mid, polygon);
}

/**
 * Renvoie la liste des points intermédiaires (sans le départ, avec l'arrivée
 * en dernier) à suivre pour aller de `start` à `target` sans sortir de
 * `polygon`. Si la ligne droite convient déjà, renvoie simplement [target].
 */
export function findPath(start: Pt, target: Pt, polygon: Pt[]): Pt[] {
  if (polygon.length < 3) return [target];
  if (segmentInsidePolygon(start, target, polygon)) return [target];

  const nodes: Pt[] = [start, target, ...polygon];
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (segmentInsidePolygon(nodes[i], nodes[j], polygon)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  const distTo = new Array(n).fill(Infinity);
  const prev = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);
  distTo[0] = 0;

  for (let iter = 0; iter < n; iter++) {
    let u = -1;
    let best = Infinity;
    for (let k = 0; k < n; k++) {
      if (!visited[k] && distTo[k] < best) {
        best = distTo[k];
        u = k;
      }
    }
    if (u === -1) break;
    visited[u] = true;
    for (const v of adj[u]) {
      const nd = distTo[u] + dist(nodes[u], nodes[v]);
      if (nd < distTo[v]) {
        distTo[v] = nd;
        prev[v] = u;
      }
    }
  }

  if (distTo[1] === Infinity) return [target]; // pas de chemin trouvé -> repli sur la ligne droite

  const path: Pt[] = [];
  let cur = 1;
  while (cur !== -1) {
    path.unshift(nodes[cur]);
    cur = prev[cur];
  }
  return path.slice(1);
}
