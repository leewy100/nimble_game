export type Position = { x: number; y: number };

export enum EnemyType {
  BLOB = 'BLOB',
  RUNNER = 'RUNNER',
  BRUTE = 'BRUTE'
}

export enum TowerType {
  DEBRIS = 'DEBRIS',
  BLOCKADE = 'BLOCKADE',
  HEAVY_BLOCKADE = 'HEAVY_BLOCKADE',
  REINFORCED_BLOCKADE = 'REINFORCED_BLOCKADE',
  GUN_PLACEMENT = 'GUN_PLACEMENT'
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
  vx: number;
  vy: number;
  isAttacking: boolean;
  attackTimer: number;
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
  mannedByCloneId: string | null;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  targetEnemyId: string | null;
  damage: number;
  speed: number;
  isEnemy: boolean;
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
  isAttacking: boolean;
  attackTimer: number;
  path: Position[];
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
  isAttacking: boolean;
  attackTimer: number;
  path: Position[];
  manningTowerId: string | null;
}
