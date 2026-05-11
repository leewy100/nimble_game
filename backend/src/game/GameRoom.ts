import { Grid } from './Grid';
import { Enemy, Tower, Projectile, EnemyType, TowerType, Position } from './Types';
import { randomUUID } from 'crypto';

export class GameRoom {
  public id: string;
  public players: Set<string>;
  public bank: number;
  public baseHealth: number;
  public grid: Grid;

  public enemies: Enemy[] = [];
  public towers: Map<string, Tower> = new Map();
  public projectiles: Projectile[] = [];

  public wave: number = 0;
  public tickCount: number = 0;
  public isGameOver: boolean = false;

  private spawnQueue: EnemyType[] = [];
  private spawnTimer: number = 0;
  private timeBetweenWaves: number = 600; // 10 seconds at 60 fps
  private waveTimer: number = 600;

  constructor(id: string) {
    this.id = id;
    this.players = new Set();
    this.bank = 500;
    this.baseHealth = 50;
    this.grid = new Grid(20, 15);
  }

  addPlayer(playerId: string) {
    this.players.add(playerId);
  }

  removePlayer(playerId: string) {
    this.players.delete(playerId);
  }

  isEmpty(): boolean {
    return this.players.size === 0;
  }

  placeTower(playerId: string, gridX: number, gridY: number, type: TowerType): boolean {
    if (this.isGameOver) return false;

    const cost = type === TowerType.SCIENTIST ? 100 : 50;
    if (this.bank < cost) return false;

    // We allow placing a tower even if it blocks, but logic will make enemies attack it.
    if (this.grid.placeTower(gridX, gridY)) {
      this.bank -= cost;

      const towerId = randomUUID();
      const tower: Tower = {
        id: towerId,
        type,
        x: gridX,
        y: gridY,
        health: type === TowerType.REINFORCEMENT ? 500 : 100,
        maxHealth: type === TowerType.REINFORCEMENT ? 500 : 100,
        damage: type === TowerType.SCIENTIST ? 10 : 0,
        range: type === TowerType.SCIENTIST ? 3 : 0,
        fireRate: 30, // fire every 0.5 sec
        lastFired: 0
      };
      this.towers.set(towerId, tower);

      // Re-calculate paths for all active enemies
      this.recalculateEnemyPaths();
      return true;
    }
    return false;
  }

  recalculateEnemyPaths() {
    for (const enemy of this.enemies) {
      const gridX = Math.floor(enemy.x);
      const gridY = Math.floor(enemy.y);
      const newPath = this.grid.findPath(gridX, gridY);
      if (newPath) {
        enemy.path = newPath;
        enemy.targetTowerId = null;
      } else {
        // Path is blocked! Find nearest tower and target it.
        enemy.path = [];
        this.assignTargetTower(enemy);
      }
    }
  }

  assignTargetTower(enemy: Enemy) {
    let closestTowerId: string | null = null;
    let minDistance = Infinity;

    for (const [id, tower] of this.towers.entries()) {
      const dist = Math.abs(tower.x - enemy.x) + Math.abs(tower.y - enemy.y);
      if (dist < minDistance) {
        minDistance = dist;
        closestTowerId = id;
      }
    }

    enemy.targetTowerId = closestTowerId;
  }

  update() {
    if (this.isGameOver) return;
    this.tickCount++;

    this.handleWaves();
    this.updateEnemies();
    this.updateTowers();
    this.updateProjectiles();
  }

  handleWaves() {
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      if (this.waveTimer > 0) {
        this.waveTimer--;
      } else {
        this.startNextWave();
      }
    }

    if (this.spawnQueue.length > 0) {
      if (this.spawnTimer <= 0) {
        const type = this.spawnQueue.shift()!;
        this.spawnEnemy(type);
        this.spawnTimer = 60; // 1 second between spawns
      } else {
        this.spawnTimer--;
      }
    }
  }

  startNextWave() {
    this.wave++;
    this.waveTimer = this.timeBetweenWaves;

    // Simple wave generation
    const count = 5 + this.wave * 2;
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      if (this.wave > 3 && rand < 0.2) {
        this.spawnQueue.push(EnemyType.BRUTE);
      } else if (this.wave > 1 && rand < 0.4) {
        this.spawnQueue.push(EnemyType.RUNNER);
      } else {
        this.spawnQueue.push(EnemyType.BLOB);
      }
    }
  }

  spawnEnemy(type: EnemyType) {
    const startX = Math.floor(Math.random() * this.grid.width);
    const startY = 0;

    let path = this.grid.findPath(startX, startY);

    const enemy: Enemy = {
      id: randomUUID(),
      type,
      x: startX + 0.5, // Center of cell
      y: startY + 0.5,
      health: type === EnemyType.BRUTE ? 100 : (type === EnemyType.BLOB ? 30 : 15),
      maxHealth: type === EnemyType.BRUTE ? 100 : (type === EnemyType.BLOB ? 30 : 15),
      speed: type === EnemyType.RUNNER ? 0.05 : (type === EnemyType.BRUTE ? 0.015 : 0.025),
      reward: type === EnemyType.BRUTE ? 20 : 10,
      path: path || [],
      targetTowerId: null
    };

    if (!path) {
      this.assignTargetTower(enemy);
    }

    this.enemies.push(enemy);
  }

  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.targetTowerId) {
        // Attack tower logic
        const targetTower = this.towers.get(enemy.targetTowerId);
        if (targetTower) {
          const dx = (targetTower.x + 0.5) - enemy.x;
          const dy = (targetTower.y + 0.5) - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.8) {
            // Move towards tower
            enemy.x += (dx / dist) * enemy.speed;
            enemy.y += (dy / dist) * enemy.speed;
          } else {
            // Attack tower
            if (this.tickCount % 60 === 0) { // attack 1/sec
               targetTower.health -= (enemy.type === EnemyType.BRUTE ? 20 : 5);
               if (targetTower.health <= 0) {
                 this.towers.delete(enemy.targetTowerId);
                 this.grid.removeTower(targetTower.x, targetTower.y);
                 this.recalculateEnemyPaths();
               }
            }
          }
        } else {
          this.recalculateEnemyPaths(); // Target dead, recalculate
        }
      } else if (enemy.path && enemy.path.length > 0) {
        // Follow path
        const nextTarget = enemy.path[0];
        const targetX = nextTarget.x + 0.5;
        const targetY = nextTarget.y + 0.5;

        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.speed) {
          enemy.x = targetX;
          enemy.y = targetY;
          enemy.path.shift();
        } else {
          enemy.x += (dx / dist) * enemy.speed;
          enemy.y += (dy / dist) * enemy.speed;
        }
      }

      // Check if reached bottom
      if (enemy.y >= this.grid.height - 0.5) {
        this.baseHealth--;
        if (this.baseHealth <= 0) {
          this.isGameOver = true;
        }
        this.enemies.splice(i, 1);
      }
    }
  }

  updateTowers() {
    for (const tower of this.towers.values()) {
      if (tower.type !== TowerType.SCIENTIST) continue;

      if (this.tickCount - tower.lastFired >= tower.fireRate) {
        // Find target
        let target: Enemy | null = null;
        let minDist = tower.range;

        for (const enemy of this.enemies) {
          const dist = Math.sqrt(Math.pow((tower.x + 0.5) - enemy.x, 2) + Math.pow((tower.y + 0.5) - enemy.y, 2));
          if (dist <= tower.range && dist < minDist) {
            minDist = dist;
            target = enemy;
          }
        }

        if (target) {
          this.projectiles.push({
            id: randomUUID(),
            x: tower.x + 0.5,
            y: tower.y + 0.5,
            targetEnemyId: target.id,
            damage: tower.damage,
            speed: 0.2
          });
          tower.lastFired = this.tickCount;
        }
      }
    }
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const targetEnemy = this.enemies.find(e => e.id === proj.targetEnemyId);

      if (!targetEnemy) {
        this.projectiles.splice(i, 1);
        continue;
      }

      const dx = targetEnemy.x - proj.x;
      const dy = targetEnemy.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= proj.speed) {
        // Hit
        targetEnemy.health -= proj.damage;
        if (targetEnemy.health <= 0) {
          this.bank += targetEnemy.reward;
          const eIndex = this.enemies.indexOf(targetEnemy);
          if (eIndex !== -1) {
            this.enemies.splice(eIndex, 1);
          }
        }
        this.projectiles.splice(i, 1);
      } else {
        // Move
        proj.x += (dx / dist) * proj.speed;
        proj.y += (dy / dist) * proj.speed;
      }
    }
  }

  getState() {
    return {
      id: this.id,
      bank: this.bank,
      baseHealth: this.baseHealth,
      wave: this.wave,
      waveTimer: this.waveTimer,
      isGameOver: this.isGameOver,
      enemies: this.enemies,
      towers: Array.from(this.towers.values()),
      projectiles: this.projectiles
    };
  }
}
