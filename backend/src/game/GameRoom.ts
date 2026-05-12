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
  private timeBetweenWaves: number = 600;
  private waveTimer: number = 600;

  public portalX = 10;
  public portalY = 7;

  constructor(id: string) {
    this.id = id;
    this.players = new Set();
    this.bank = 120;
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

    if (gridX === this.portalX && gridY === this.portalY) return false;

    const cost = type === TowerType.SCIENTIST ? 30 : 50;
    if (this.bank < cost) return false;

    if (this.grid.placeTower(gridX, gridY)) {
      this.bank -= cost;

      const towerId = randomUUID();
      const tower: Tower = {
        id: towerId,
        type,
        x: gridX,
        y: gridY,
        health: type === TowerType.REINFORCEMENT ? 500 : 50,
        maxHealth: type === TowerType.REINFORCEMENT ? 500 : 50,
        damage: type === TowerType.SCIENTIST ? 5 : 0,
        range: type === TowerType.SCIENTIST ? 2.5 : 0,
        fireRate: 45,
        lastFired: 0
      };
      this.towers.set(towerId, tower);

      this.recalculateEnemyPaths();
      return true;
    }
    return false;
  }

  upgradeTower(towerId: string, stat: 'damage' | 'speed' | 'range' | 'armor'): boolean {
    if (this.isGameOver) return false;

    const tower = this.towers.get(towerId);
    if (!tower) return false;

    // Upgrades cost $40 each for simplicity right now
    const cost = 40;
    if (this.bank < cost) return false;

    this.bank -= cost;

    switch (stat) {
      case 'damage':
        tower.damage += 5;
        break;
      case 'speed':
        tower.fireRate = Math.max(10, tower.fireRate - 10);
        break;
      case 'range':
        tower.range += 1;
        break;
      case 'armor':
        tower.maxHealth += 100;
        tower.health += 100;
        break;
    }
    return true;
  }

  recalculateEnemyPaths() {
    for (const enemy of this.enemies) {
      if (enemy.type === EnemyType.BRUTE && this.towers.size > 0) {
        this.assignTargetTower(enemy);
        continue;
      }

      const gridX = Math.floor(enemy.x);
      const gridY = Math.floor(enemy.y);
      const newPath = this.grid.findPath(gridX, gridY, this.portalX, this.portalY);

      if (newPath) {
        enemy.path = newPath;
        enemy.targetTowerId = null;
      } else {
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
    if (closestTowerId) {
      const tower = this.towers.get(closestTowerId)!;
      const path = this.grid.findPath(Math.floor(enemy.x), Math.floor(enemy.y), tower.x, tower.y);
      enemy.path = path || [];
    }
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
        this.spawnTimer = 60;
      } else {
        this.spawnTimer--;
      }
    }
  }

  startNextWave() {
    this.wave++;
    this.waveTimer = this.timeBetweenWaves;

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
    let startX = 0;
    let startY = 0;

    const side = (this.wave <= 4) ? this.wave : Math.floor(Math.random() * 4) + 1;

    if (side === 1) { // Top
      startX = Math.floor(Math.random() * this.grid.width);
      startY = 0;
    } else if (side === 2) { // Right
      startX = this.grid.width - 1;
      startY = Math.floor(Math.random() * this.grid.height);
    } else if (side === 3) { // Bottom
      startX = Math.floor(Math.random() * this.grid.width);
      startY = this.grid.height - 1;
    } else if (side === 4) { // Left
      startX = 0;
      startY = Math.floor(Math.random() * this.grid.height);
    }

    const enemy: Enemy = {
      id: randomUUID(),
      type,
      x: startX + 0.5,
      y: startY + 0.5,
      health: type === EnemyType.BRUTE ? 150 : (type === EnemyType.BLOB ? 30 : 15),
      maxHealth: type === EnemyType.BRUTE ? 150 : (type === EnemyType.BLOB ? 30 : 15),
      speed: type === EnemyType.RUNNER ? 0.05 : (type === EnemyType.BRUTE ? 0.015 : 0.025),
      reward: type === EnemyType.BRUTE ? 30 : 10,
      path: [],
      targetTowerId: null
    };

    if (type === EnemyType.BRUTE && this.towers.size > 0) {
      this.assignTargetTower(enemy);
    } else {
      const path = this.grid.findPath(startX, startY, this.portalX, this.portalY);
      if (path) {
        enemy.path = path;
      } else {
        this.assignTargetTower(enemy);
      }
    }

    this.enemies.push(enemy);
  }

  updateEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      if (enemy.targetTowerId) {
        const targetTower = this.towers.get(enemy.targetTowerId);
        if (targetTower) {
          const dx = (targetTower.x + 0.5) - enemy.x;
          const dy = (targetTower.y + 0.5) - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.8) {
            if (enemy.path && enemy.path.length > 0) {
                const nextTarget = enemy.path[0];
                const targetX = nextTarget.x + 0.5;
                const targetY = nextTarget.y + 0.5;
                const pdx = targetX - enemy.x;
                const pdy = targetY - enemy.y;
                const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pdist <= enemy.speed) {
                    enemy.x = targetX;
                    enemy.y = targetY;
                    enemy.path.shift();
                } else {
                    enemy.x += (pdx / pdist) * enemy.speed;
                    enemy.y += (pdy / pdist) * enemy.speed;
                }
            } else {
               enemy.x += (dx / dist) * enemy.speed;
               enemy.y += (dy / dist) * enemy.speed;
            }
          } else {
            if (this.tickCount % 60 === 0) {
               targetTower.health -= (enemy.type === EnemyType.BRUTE ? 25 : 5);
               if (targetTower.health <= 0) {
                 this.towers.delete(enemy.targetTowerId);
                 this.grid.removeTower(targetTower.x, targetTower.y);
                 this.recalculateEnemyPaths();
               }
            }
          }
        } else {
          this.recalculateEnemyPaths();
        }
      } else if (enemy.path && enemy.path.length > 0) {
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
      } else {
         const dx = (this.portalX + 0.5) - enemy.x;
         const dy = (this.portalY + 0.5) - enemy.y;
         const dist = Math.sqrt(dx * dx + dy * dy);
         if (dist > enemy.speed) {
             enemy.x += (dx / dist) * enemy.speed;
             enemy.y += (dy / dist) * enemy.speed;
         }
      }

      const distToPortal = Math.sqrt(Math.pow((this.portalX + 0.5) - enemy.x, 2) + Math.pow((this.portalY + 0.5) - enemy.y, 2));
      if (distToPortal < 0.5 && !enemy.targetTowerId) {
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
      projectiles: this.projectiles,
      portalX: this.portalX,
      portalY: this.portalY
    };
  }
}
