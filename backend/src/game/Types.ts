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
  path: Position[];
  targetTowerId: string | null;
  vx: number; // For animation direction
  vy: number;
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
  fireRate: number;
  lastFired: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetEnemyId: string | null; // null if hitting a creature without id? No, must target enemy.
  damage: number;
  speed: number;
  isEnemy: boolean; // if we want enemies to shoot later
}

export interface ScientistNPC {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  phrase: string | null;
  phraseTimer: number;
  isJoining: boolean;
  vx: number;
  vy: number;
}

export interface Clone {
  id: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  speed: number;
  targetX: number;
  targetY: number;
  lastFired: number;
  vx: number;
  vy: number;
}
