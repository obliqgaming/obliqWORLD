// Pathfinding par grille (rasterisation de la walkable_zone + A*).
//
// L'ancienne version utilisait un "graphe de visibilité" géométrique (relier le
// départ, l'arrivée et les sommets du polygone par des segments qui restent
// dans la zone). Ça marche bien sur un polygone simple et convexe, mais ça
// devient peu fiable sur une forme complexe/concave à plusieurs pièces (comme
// l'étage de l'auberge) : un simple point testé au milieu d'un segment ne
// suffit pas à garantir que TOUT le segment reste dans la zone, et un
// polygone un peu irrégulier peut produire des faux positifs qui laissent le
// personnage couper à travers un mur.
//
// Cette version est plus "brute force" mais beaucoup plus robuste : on
// transforme la zone marchable en grille de cases marchables/non-marchables
// (comme une carte de jeu à cases), on cherche le chemin le plus court sur
// cette grille avec A* (8 directions, sans couper les coins), puis on
// "lisse" le chemin obtenu pour ne garder que les points de virage
// nécessaires (sinon le personnage zigzague case par case).

export type Pt = { x: number; y: number };

const GRID_COLS = 160;
const GRID_ROWS = 160;

type Grid = {
  cols: number;
  rows: number;
  cells: Uint8Array; // 1 = marchable
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

// Une grille par polygone (mise en cache tant que la référence de l'array ne
// change pas, ce qui est le cas pendant toute la visite d'une scène).
const gridCache = new WeakMap<object, Grid>();

function pointInPolygon(p: Pt, polygon: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function buildGrid(polygon: Pt[], obstacles: Pt[][]): Grid {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // petite marge pour ne pas rogner les coins du polygone
  const mx = (maxX - minX) * 0.02 || 1;
  const my = (maxY - minY) * 0.02 || 1;
  minX -= mx;
  maxX += mx;
  minY -= my;
  maxY += my;

  const cols = GRID_COLS;
  const rows = GRID_ROWS;
  const cells = new Uint8Array(cols * rows);
  const cellW = (maxX - minX) / cols;
  const cellH = (maxY - minY) / rows;

  for (let j = 0; j < rows; j++) {
    const cy = minY + (j + 0.5) * cellH;
    for (let i = 0; i < cols; i++) {
      const cx = minX + (i + 0.5) * cellW;
      const p = { x: cx, y: cy };
      if (!pointInPolygon(p, polygon)) continue;
      // une case dans un obstacle (table, meuble isolé...) reste non-marchable
      // même si elle est à l'intérieur du contour principal
      if (obstacles.some((hole) => pointInPolygon(p, hole))) continue;
      cells[j * cols + i] = 1;
    }
  }

  return { cols, rows, cells, minX, maxX, minY, maxY };
}

// La grille est mise en cache par référence du polygone principal : tant que
// la scène n'est pas re-fetchée, `polygon` et `obstacles` viennent du même
// objet Scene et changent toujours ensemble, donc c'est une clé suffisante.
function getGrid(polygon: Pt[], obstacles: Pt[][]): Grid {
  const cached = gridCache.get(polygon);
  if (cached) return cached;
  const grid = buildGrid(polygon, obstacles);
  gridCache.set(polygon, grid);
  return grid;
}

function toCell(grid: Grid, p: Pt): { i: number; j: number } {
  const i = Math.floor(((p.x - grid.minX) / (grid.maxX - grid.minX)) * grid.cols);
  const j = Math.floor(((p.y - grid.minY) / (grid.maxY - grid.minY)) * grid.rows);
  return {
    i: Math.min(grid.cols - 1, Math.max(0, i)),
    j: Math.min(grid.rows - 1, Math.max(0, j)),
  };
}

function cellCenter(grid: Grid, i: number, j: number): Pt {
  const cellW = (grid.maxX - grid.minX) / grid.cols;
  const cellH = (grid.maxY - grid.minY) / grid.rows;
  return { x: grid.minX + (i + 0.5) * cellW, y: grid.minY + (j + 0.5) * cellH };
}

function isWalkableCell(grid: Grid, i: number, j: number): boolean {
  if (i < 0 || j < 0 || i >= grid.cols || j >= grid.rows) return false;
  return grid.cells[j * grid.cols + i] === 1;
}

// Si le point de départ/arrivée tombe hors zone marchable (ex: un vieux
// personnage enregistré avant qu'on corrige les zones), on cherche la case
// marchable la plus proche au lieu d'échouer bêtement.
function nearestWalkableCell(grid: Grid, i: number, j: number): { i: number; j: number } | null {
  if (isWalkableCell(grid, i, j)) return { i, j };
  const maxR = Math.max(grid.cols, grid.rows);
  for (let r = 1; r <= maxR; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        if (isWalkableCell(grid, i + di, j + dj)) return { i: i + di, j: j + dj };
      }
    }
  }
  return null;
}

// Ligne de vue: vrai si TOUT le segment a->b reste sur des cases marchables
// (on échantillonne le long du segment tous les demi-cases, pas juste le
// milieu comme l'ancienne version).
function hasLineOfSight(grid: Grid, a: Pt, b: Pt): boolean {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const cellW = (grid.maxX - grid.minX) / grid.cols;
  const cellH = (grid.maxY - grid.minY) / grid.rows;
  const step = Math.max(Math.min(cellW, cellH) / 2, 1e-6);
  const steps = Math.max(1, Math.ceil(dist / step));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const c = toCell(grid, p);
    if (!isWalkableCell(grid, c.i, c.j)) return false;
  }
  return true;
}

type Cell = { i: number; j: number };

// A* sur la grille, déplacement 8 directions, sans couper les coins (une
// diagonale n'est autorisée que si les deux cases orthogonales adjacentes
// sont elles aussi marchables — sinon le perso pourrait se faufiler entre
// deux coins de murs qui se touchent).
function gridAStar(grid: Grid, start: Cell, goal: Cell): Cell[] | null {
  const cols = grid.cols;
  const total = grid.cols * grid.rows;
  const idx = (i: number, j: number) => j * cols + i;
  const startIdx = idx(start.i, start.j);
  const goalIdx = idx(goal.i, goal.j);

  const gScore = new Float64Array(total).fill(Infinity);
  const fScore = new Float64Array(total).fill(Infinity);
  const cameFrom = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);

  const h = (i: number, j: number) => Math.hypot(goal.i - i, goal.j - j);

  gScore[startIdx] = 0;
  fScore[startIdx] = h(start.i, start.j);

  // petit tas binaire maison (pas de dépendance externe)
  const heap: number[] = [startIdx];
  const heapF: number[] = [fScore[startIdx]];
  const swap = (a: number, b: number) => {
    [heap[a], heap[b]] = [heap[b], heap[a]];
    [heapF[a], heapF[b]] = [heapF[b], heapF[a]];
  };
  function heapPush(id: number, f: number) {
    heap.push(id);
    heapF.push(f);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heapF[p] <= heapF[c]) break;
      swap(p, c);
      c = p;
    }
  }
  function heapPop(): number {
    const top = heap[0];
    const lastId = heap.pop()!;
    const lastF = heapF.pop()!;
    if (heap.length > 0) {
      heap[0] = lastId;
      heapF[0] = lastF;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = c * 2 + 2;
        let smallest = c;
        if (l < heap.length && heapF[l] < heapF[smallest]) smallest = l;
        if (r < heap.length && heapF[r] < heapF[smallest]) smallest = r;
        if (smallest === c) break;
        swap(c, smallest);
        c = smallest;
      }
    }
    return top;
  }

  const neighbors: Array<[number, number, number]> = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];

  while (heap.length > 0) {
    const current = heapPop();
    if (closed[current]) continue;
    if (current === goalIdx) break;
    closed[current] = 1;
    const ci = current % cols;
    const cj = (current / cols) | 0;

    for (const [di, dj, cost] of neighbors) {
      const ni = ci + di;
      const nj = cj + dj;
      if (!isWalkableCell(grid, ni, nj)) continue;
      if (di !== 0 && dj !== 0) {
        // interdit de "couper le coin" en diagonale entre deux murs
        if (!isWalkableCell(grid, ci + di, cj) || !isWalkableCell(grid, ci, cj + dj)) continue;
      }
      const nIdx = idx(ni, nj);
      if (closed[nIdx]) continue;
      const tentative = gScore[current] + cost;
      if (tentative < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentative;
        fScore[nIdx] = tentative + h(ni, nj);
        heapPush(nIdx, fScore[nIdx]);
      }
    }
  }

  if (gScore[goalIdx] === Infinity) return null;

  const path: Cell[] = [];
  let cur = goalIdx;
  while (cur !== -1) {
    path.unshift({ i: cur % cols, j: (cur / cols) | 0 });
    if (cur === startIdx) break;
    cur = cameFrom[cur];
  }
  return path;
}

// Réduit un chemin en escalier (case par case) à ses seuls points de virage
// utiles, en ne gardant un point que quand la ligne droite depuis le dernier
// point conservé ("ancre") ne reste plus entièrement marchable.
function simplifyPath(grid: Grid, points: Pt[]): Pt[] {
  if (points.length <= 2) return points;
  const result: Pt[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (!hasLineOfSight(grid, result[result.length - 1], points[i + 1])) {
      result.push(points[i]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Renvoie la liste des points intermédiaires (sans le départ, avec l'arrivée
 * en dernier) à suivre pour aller de `start` à `target` sans sortir de
 * `polygon` et sans traverser un des polygones d'`obstacles` (tables, meubles
 * isolés au milieu de la pièce...). Si la ligne droite convient déjà, renvoie
 * simplement [target].
 */
export function findPath(
  start: Pt,
  target: Pt,
  polygon: Pt[] | null | undefined,
  obstacles?: Pt[][] | null,
): Pt[] {
  if (!polygon || polygon.length < 3) return [target];

  const grid = getGrid(polygon, obstacles ?? []);

  // trajet direct possible ? (cas le plus fréquent, aucun calcul en plus)
  if (hasLineOfSight(grid, start, target)) return [target];

  const startCellRaw = toCell(grid, start);
  const targetCellRaw = toCell(grid, target);
  const startCell = nearestWalkableCell(grid, startCellRaw.i, startCellRaw.j);
  const targetCell = nearestWalkableCell(grid, targetCellRaw.i, targetCellRaw.j);
  if (!startCell || !targetCell) return [target];

  const cellPath = gridAStar(grid, startCell, targetCell);
  if (!cellPath || cellPath.length === 0) return [target];

  const pts = cellPath.map((c) => cellCenter(grid, c.i, c.j));
  pts[0] = start;
  pts[pts.length - 1] = target;

  const smoothed = simplifyPath(grid, pts);
  return smoothed.slice(1);
}
