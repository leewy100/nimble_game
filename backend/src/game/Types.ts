export type Position = { x: number; y: number };

export enum EnemyType {
  BLOB = 'BLOB',
  RUNNER = 'RUNNER',
  BRUTE = 'BRUTE'
}

export enum TowerType {
  SCIENTIST = 'SCIENTIST',
  REINFORCEMENT = 'REINFORCEMENT'
}

export interface Enemy {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  reward: number;
  path: Position[]; // Current path
  targetTowerId: string | null; // For brutes or blocked enemies
}

export interface Tower {
  id: string;
  type: TowerType;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  damage: number;
  range: number;
  fireRate: number; // ticks between shots
  lastFired: number; // tick counter
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetEnemyId: string;
  damage: number;
  speed: number;
}
