export type Position = { x: number; y: number };

export class Grid {
  public width: number;
  public height: number;
  public cells: number[][]; // 0: empty, 1: tower

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array.from({ length: height }, () => Array(width).fill(0));
  }

  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  placeTower(x: number, y: number): boolean {
    if (this.isValidPosition(x, y) && this.cells[y][x] === 0) {
      this.cells[y][x] = 1;
      return true;
    }
    return false;
  }

  removeTower(x: number, y: number) {
    if (this.isValidPosition(x, y)) {
      this.cells[y][x] = 0;
    }
  }

  // A* pathfinding from start to a specific target
  findPath(startX: number, startY: number, targetX: number, targetY: number, ignoreTowers: boolean = false): Position[] | null {
    const start = { x: startX, y: startY };

    const openSet = [start];
    const cameFrom = new Map<string, Position>();

    const gScore = new Map<string, number>();
    gScore.set(`${start.x},${start.y}`, 0);

    const fScore = new Map<string, number>();
    // Heuristic: manhattan distance to target
    fScore.set(`${start.x},${start.y}`, Math.abs(start.x - targetX) + Math.abs(start.y - targetY));

    while (openSet.length > 0) {
      // Get node in openSet with lowest fScore
      let currentIdx = 0;
      for (let i = 1; i < openSet.length; i++) {
        const cur = openSet[i];
        const best = openSet[currentIdx];
        if ((fScore.get(`${cur.x},${cur.y}`) || Infinity) < (fScore.get(`${best.x},${best.y}`) || Infinity)) {
          currentIdx = i;
        }
      }

      const current = openSet[currentIdx];

      // If we reached the target
      if (current.x === targetX && current.y === targetY) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.splice(currentIdx, 1);

      const neighbors = [
        { x: current.x, y: current.y - 1 }, // up
        { x: current.x, y: current.y + 1 }, // down
        { x: current.x - 1, y: current.y }, // left
        { x: current.x + 1, y: current.y }, // right
      ];

      for (const neighbor of neighbors) {
        if (!this.isValidPosition(neighbor.x, neighbor.y)) continue;
        if (!ignoreTowers && this.cells[neighbor.y][neighbor.x] !== 0 && !(neighbor.x === targetX && neighbor.y === targetY)) continue; // Blocked

        const tentative_gScore = (gScore.get(`${current.x},${current.y}`) || Infinity) + 1;
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        if (tentative_gScore < (gScore.get(neighborKey) || Infinity)) {
          cameFrom.set(neighborKey, current);
          gScore.set(neighborKey, tentative_gScore);
          fScore.set(neighborKey, tentative_gScore + Math.abs(neighbor.x - targetX) + Math.abs(neighbor.y - targetY));

          if (!openSet.some(n => n.x === neighbor.x && n.y === neighbor.y)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return null; // No path found
  }

  private reconstructPath(cameFrom: Map<string, Position>, current: Position): Position[] {
    const path = [current];
    let currKey = `${current.x},${current.y}`;
    while (cameFrom.has(currKey)) {
      current = cameFrom.get(currKey)!;
      path.unshift(current);
      currKey = `${current.x},${current.y}`;
    }
    return path;
  }
}
