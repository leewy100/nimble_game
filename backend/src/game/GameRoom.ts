import { Grid } from './Grid';
import { Enemy, Tower, Projectile, EnemyType, TowerType, Position, ScientistNPC, Clone } from './Types';
import { randomUUID } from 'crypto';

const PHRASES = [
  "Game over, man, game over!", "It's a trap!", "They're coming out of the walls!",
  "Great Scott!", "I'm giving her all she's got!", "I have a bad feeling about this...",
  "Don't cross the streams!", "Danger, Will Robinson!", "By Grabthar's Hammer!",
  "We need more time!", "The containment field is failing!", "This was not in the hypothesis!"
];

export class GameRoom {
  public id: string;
  public players: Set<string>;
  public bank: number;
  public baseHealth: number;
  public grid: Grid;

  public enemies: Enemy[] = [];
  public towers: Map<string, Tower> = new Map();
  public projectiles: Projectile[] = [];
  public scientists: ScientistNPC[] = [];
  public clones: Clone[] = [];

  public wave: number = 0;
  public tickCount: number = 0;
  public isGameOver: boolean = false;

  private spawnQueue: EnemyType[] = [];
  private spawnTimer: number = 0;
  private timeBetweenWaves: number = 600;
  private waveTimer: number = 600;
  public waveInProgress: boolean = false;

  public portalX = 10;
  public portalY = 7;

  public cloneDamage: number = 5;
  public cloneMaxHealth: number = 20;
  public cloneFireRate: number = 30;
  public insurancePolicyCost: number = 100;
  public cloneUpgrades: number = 0;

  constructor(id: string) {
    this.id = id;
    this.players = new Set();
    this.bank = 120;
    this.baseHealth = 50;
    this.grid = new Grid(20, 15);

    for (let i = 0; i < 3; i++) {
      this.scientists.push(this.createScientist(false));
    }
  }

  createScientist(isJoining: boolean): ScientistNPC {
    let x = this.portalX + 0.5;
    let y = this.portalY + 0.5;

    if (isJoining) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { x = Math.random() * this.grid.width; y = 0; }
      else if (side === 1) { x = this.grid.width; y = Math.random() * this.grid.height; }
      else if (side === 2) { x = Math.random() * this.grid.width; y = this.grid.height; }
      else { x = 0; y = Math.random() * this.grid.height; }
    } else {
      x += (Math.random() - 0.5) * 2;
      y += (Math.random() - 0.5) * 2;
    }

    return {
      id: randomUUID(), x, y, health: 10, maxHealth: 10, speed: 0.03,
      phrase: null, phraseTimer: 0, isJoining, vx: 0, vy: 0, isAttacking: false, attackTimer: 0, path: []
    };
  }

  addPlayer(playerId: string) { this.players.add(playerId); }
  removePlayer(playerId: string) { this.players.delete(playerId); }
  isEmpty(): boolean { return this.players.size === 0; }


  placeTower(playerId: string, gridX: number, gridY: number, type: TowerType): boolean {
    if (this.isGameOver) return false;
    if (gridX === this.portalX && gridY === this.portalY) return false;

    let cost = 50;
    if (type !== TowerType.DEBRIS) return false; // Players can only build Debris initially
    if (this.bank < cost) return false;

    if (this.grid.placeTower(gridX, gridY)) {
      this.bank -= cost;
      const towerId = randomUUID();
      const tower: Tower = {
        id: towerId, type,
        x: gridX, y: gridY,
        health: 50, maxHealth: 50,
        damage: 0, range: 0,
        fireRate: 0, lastFired: 0,
        mannedByCloneId: null
      };
      this.towers.set(towerId, tower);
      this.recalculateEnemyPaths();
      return true;
    }
    return false;
  }

  upgradeTower(towerId: string, stat: string): boolean {
    if (this.isGameOver) return false;
    const tower = this.towers.get(towerId);
    if (!tower) return false;

    if (tower.type === TowerType.DEBRIS && this.bank >= 100) {
       this.bank -= 100;
       tower.type = TowerType.BLOCKADE;
       tower.maxHealth = 200; tower.health = 200;
       return true;
    } else if (tower.type === TowerType.BLOCKADE && this.bank >= 200) {
       this.bank -= 200;
       tower.type = TowerType.HEAVY_BLOCKADE;
       tower.maxHealth = 500; tower.health = 500;
       return true;
    } else if (tower.type === TowerType.HEAVY_BLOCKADE && this.bank >= 400) {
       this.bank -= 400;
       tower.type = TowerType.REINFORCED_BLOCKADE;
       tower.maxHealth = 1000; tower.health = 1000;
       return true;
    } else if (tower.type === TowerType.REINFORCED_BLOCKADE && this.bank >= 200) {
       // Search for a free clone
       let freeClone = this.clones.find(c => c.manningTowerId === null);
       if (!freeClone) return false; // Cannot build gun without a clone

       this.bank -= 200;
       tower.type = TowerType.GUN_PLACEMENT;
       tower.maxHealth = 1500; tower.health = 1500;

       freeClone.manningTowerId = tower.id;
       tower.mannedByCloneId = freeClone.id;
       return true;
    }
    return false;
  }

  upgradeClones(): boolean {
    if (this.isGameOver || this.bank < this.insurancePolicyCost) return false;
    this.bank -= this.insurancePolicyCost;
    this.insurancePolicyCost = Math.floor(this.insurancePolicyCost * 1.5);
    this.cloneDamage += 5;
    this.cloneMaxHealth += 20;
    this.cloneFireRate = Math.max(10, this.cloneFireRate - 5);
    for (const clone of this.clones) {
      clone.maxHealth = this.cloneMaxHealth;
      clone.health = this.cloneMaxHealth;
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
    this.updateAI();
  }

  handleWaves() {
    if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
      if (this.waveInProgress) {
        this.waveInProgress = false;
        // Wave End Logic
        const bonus = this.scientists.length * 20;
        this.bank += bonus;

        // Spawn 1 new scientist
        this.scientists.push(this.createScientist(true));
      }

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
        this.spawnTimer = Math.max(5, 60 - this.wave * 5); // Spawn faster in later waves
      } else {
        this.spawnTimer--;
      }
    }
  }

  startNextWave() {
    this.wave++;
    this.waveTimer = this.timeBetweenWaves;
    this.waveInProgress = true;

    // Spawn new clones equal to number of living scientists
    for (let i = 0; i < this.scientists.length; i++) {
       this.clones.push({
         id: randomUUID(),
         x: this.portalX + 0.5 + (Math.random() - 0.5),
         y: this.portalY + 0.5 + (Math.random() - 0.5),
         health: this.cloneMaxHealth,
         maxHealth: this.cloneMaxHealth,
         speed: 0.015, // slower clones
         targetX: this.portalX + 0.5,
         targetY: this.portalY + 0.5,
         lastFired: 0,
         vx: 0, vy: 0, isAttacking: false, attackTimer: 0, path: [], manningTowerId: null
       });
    }

    const count = 10 + Math.pow(this.wave, 1.5) * 5; // Much larger batches scaling exponentially
    for (let i = 0; i < count; i++) {
      const rand = Math.random();
      if (this.wave > 3 && rand < 0.1) this.spawnQueue.push(EnemyType.BRUTE);
      else if (this.wave > 1 && rand < 0.3) this.spawnQueue.push(EnemyType.RUNNER);
      else this.spawnQueue.push(EnemyType.BLOB);
    }
  }

  spawnEnemy(type: EnemyType) {
    let startX = 0; let startY = 0;
    const side = (this.wave <= 4) ? this.wave : Math.floor(Math.random() * 4) + 1;

    if (side === 1) { startX = Math.floor(Math.random() * this.grid.width); startY = 0; }
    else if (side === 2) { startX = this.grid.width - 1; startY = Math.floor(Math.random() * this.grid.height); }
    else if (side === 3) { startX = Math.floor(Math.random() * this.grid.width); startY = this.grid.height - 1; }
    else if (side === 4) { startX = 0; startY = Math.floor(Math.random() * this.grid.height); }

    const enemy: Enemy = {
      id: randomUUID(), type, x: startX + 0.5, y: startY + 0.5,
      health: type === EnemyType.BRUTE ? 150 : (type === EnemyType.BLOB ? 30 : 15),
      maxHealth: type === EnemyType.BRUTE ? 150 : (type === EnemyType.BLOB ? 30 : 15),
      speed: type === EnemyType.RUNNER ? 0.05 : (type === EnemyType.BRUTE ? 0.015 : 0.025),
      reward: type === EnemyType.BRUTE ? 30 : 10,
      path: [], targetTowerId: null, vx: 0, vy: 0, isAttacking: false, attackTimer: 0
    };

    if (type === EnemyType.BRUTE && this.towers.size > 0) this.assignTargetTower(enemy);
    else {
      const path = this.grid.findPath(startX, startY, this.portalX, this.portalY);
      if (path) enemy.path = path;
      else this.assignTargetTower(enemy);
    }
    this.enemies.push(enemy);
  }

  updateEnemies() {


    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.attackTimer > 0) {
         enemy.attackTimer--;
         enemy.isAttacking = true;
      } else {
         enemy.isAttacking = false;
      }


      let prevX = enemy.x; let prevY = enemy.y;

      if (enemy.targetTowerId) {
        const targetTower = this.towers.get(enemy.targetTowerId);
        if (targetTower) {
          const dx = (targetTower.x + 0.5) - enemy.x;
          const dy = (targetTower.y + 0.5) - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 0.8) {
            if (enemy.path && enemy.path.length > 0) {
                const nextTarget = enemy.path[0];
                const targetX = nextTarget.x + 0.5; const targetY = nextTarget.y + 0.5;
                const pdx = targetX - enemy.x; const pdy = targetY - enemy.y;
                const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pdist <= enemy.speed) { enemy.x = targetX; enemy.y = targetY; enemy.path.shift(); }
                else { enemy.x += (pdx / pdist) * enemy.speed; enemy.y += (pdy / pdist) * enemy.speed; }
            } else { enemy.x += (dx / dist) * enemy.speed; enemy.y += (dy / dist) * enemy.speed; }
          } else {


            if (this.tickCount % 60 === 0) {
               enemy.isAttacking = true;
               enemy.attackTimer = 15; // Hold animation for 15 ticks (1/4 second)
               targetTower.health -= (enemy.type === EnemyType.BRUTE ? 100 : 5);



               if (targetTower.health <= 0) {
                 if (targetTower.mannedByCloneId) {
                    const cloneIndex = this.clones.findIndex(c => c.id === targetTower.mannedByCloneId);
                    if (cloneIndex !== -1) {
                       this.clones.splice(cloneIndex, 1);
                    }
                 }
                 this.towers.delete(enemy.targetTowerId);

                 this.grid.removeTower(targetTower.x, targetTower.y);
                 this.recalculateEnemyPaths();
               }
            }
          }
        } else this.recalculateEnemyPaths();
      } else if (enemy.path && enemy.path.length > 0) {
        const nextTarget = enemy.path[0];
        const targetX = nextTarget.x + 0.5; const targetY = nextTarget.y + 0.5;
        const dx = targetX - enemy.x; const dy = targetY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= enemy.speed) { enemy.x = targetX; enemy.y = targetY; enemy.path.shift(); }
        else { enemy.x += (dx / dist) * enemy.speed; enemy.y += (dy / dist) * enemy.speed; }
      } else {
         const dx = (this.portalX + 0.5) - enemy.x; const dy = (this.portalY + 0.5) - enemy.y;
         const dist = Math.sqrt(dx * dx + dy * dy);
         if (dist > enemy.speed) { enemy.x += (dx / dist) * enemy.speed; enemy.y += (dy / dist) * enemy.speed; }
      }

      enemy.vx = enemy.x - prevX; enemy.vy = enemy.y - prevY;

      const distToPortal = Math.sqrt(Math.pow((this.portalX + 0.5) - enemy.x, 2) + Math.pow((this.portalY + 0.5) - enemy.y, 2));
      if (distToPortal < 0.5 && !enemy.targetTowerId) {
        this.baseHealth--;
        if (this.baseHealth <= 0) this.isGameOver = true;
        this.enemies.splice(i, 1);
      }
    }
  }

  updateTowers() {
    for (const tower of this.towers.values()) {
      if (tower.type !== TowerType.GUN_PLACEMENT || !tower.mannedByCloneId) continue;

      if (this.tickCount - tower.lastFired >= this.cloneFireRate) {
        let target: Enemy | null = null; let minDist = 6;
        for (const enemy of this.enemies) {
          const dist = Math.sqrt(Math.pow((tower.x + 0.5) - enemy.x, 2) + Math.pow((tower.y + 0.5) - enemy.y, 2));
          if (dist <= 6 && dist < minDist) { minDist = dist; target = enemy; }
        }
        if (target) {
          this.projectiles.push({
            id: randomUUID(), x: tower.x + 0.5, y: tower.y + 0.5,
            targetEnemyId: target.id, damage: this.cloneDamage * 2, speed: 0.2, isEnemy: false
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

      if (!targetEnemy) { this.projectiles.splice(i, 1); continue; }

      const dx = targetEnemy.x - proj.x; const dy = targetEnemy.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= proj.speed) {
        targetEnemy.health -= proj.damage;
        if (targetEnemy.health <= 0) {
          this.bank += targetEnemy.reward;
          const eIndex = this.enemies.indexOf(targetEnemy);
          if (eIndex !== -1) this.enemies.splice(eIndex, 1);
        }
        this.projectiles.splice(i, 1);
      } else {
        proj.x += (dx / dist) * proj.speed; proj.y += (dy / dist) * proj.speed;
      }
    }
  }


  canMove(x: number, y: number): boolean {
    const gridX = Math.floor(x);
    const gridY = Math.floor(y);
    if (!this.grid.isValidPosition(gridX, gridY)) return false;
    return this.grid.cells[gridY][gridX] === 0;
  }


  updateAI() {
    // Update Scientists
    for (let i = this.scientists.length - 1; i >= 0; i--) {
      const sci = this.scientists[i];
      if (sci.phraseTimer > 0) sci.phraseTimer--;
      else if (Math.random() < 0.005) {
        sci.phrase = PHRASES[Math.floor(Math.random() * PHRASES.length)];
        sci.phraseTimer = 180;
      } else sci.phrase = null;

      let prevX = sci.x;
      let prevY = sci.y;

      if (sci.isJoining) {
        const distToPortal = Math.sqrt(Math.pow((this.portalX + 0.5) - sci.x, 2) + Math.pow((this.portalY + 0.5) - sci.y, 2));
        if (distToPortal < 1) {
          sci.isJoining = false;
        } else {
          // A* pathfinding to portal
          if (!sci.path || sci.path.length === 0 || Math.random() < 0.05) {
             const path = this.grid.findPath(Math.floor(sci.x), Math.floor(sci.y), this.portalX, this.portalY);
             sci.path = path || [];
          }

          if (sci.path && sci.path.length > 0) {
            const nextTarget = sci.path[0];
            const targetX = nextTarget.x + 0.5; const targetY = nextTarget.y + 0.5;
            const pdx = targetX - sci.x; const pdy = targetY - sci.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist <= sci.speed) { sci.x = targetX; sci.y = targetY; sci.path.shift(); }
            else { sci.x += (pdx / pdist) * sci.speed; sci.y += (pdy / pdist) * sci.speed; }
          }
        }
      } else {
        let nearestEnemy: Enemy | null = null; let minDist = 4;
        for (const enemy of this.enemies) {
          const dist = Math.sqrt(Math.pow(enemy.x - sci.x, 2) + Math.pow(enemy.y - sci.y, 2));
          if (dist < minDist) { minDist = dist; nearestEnemy = enemy; }
        }
        if (nearestEnemy) {
          // Flee direct
          const dx = sci.x - nearestEnemy.x; const dy = sci.y - nearestEnemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let tx = sci.x + (dx / dist) * sci.speed;
          let ty = sci.y + (dy / dist) * sci.speed;
          if (this.canMove(tx, ty)) { sci.x = tx; sci.y = ty; }
          sci.path = [];
        } else {
          // Wander near portal using A* if strayed
          const pDist = Math.sqrt(Math.pow((this.portalX + 0.5) - sci.x, 2) + Math.pow((this.portalY + 0.5) - sci.y, 2));
          if (pDist > 3) {
            if (!sci.path || sci.path.length === 0 || Math.random() < 0.05) {
               const path = this.grid.findPath(Math.floor(sci.x), Math.floor(sci.y), this.portalX, this.portalY);
               sci.path = path || [];
            }
            if (sci.path && sci.path.length > 0) {
              const nextTarget = sci.path[0];
              const targetX = nextTarget.x + 0.5; const targetY = nextTarget.y + 0.5;
              const pdx = targetX - sci.x; const pdy = targetY - sci.y;
              const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
              if (pdist <= (sci.speed * 0.5)) { sci.x = targetX; sci.y = targetY; sci.path.shift(); }
              else { sci.x += (pdx / pdist) * (sci.speed * 0.5); sci.y += (pdy / pdist) * (sci.speed * 0.5); }
            }
          } else {
             sci.path = [];
             if (Math.random() < 0.05) {
               let tx = sci.x + (Math.random() - 0.5) * sci.speed; let ty = sci.y + (Math.random() - 0.5) * sci.speed;
               if (this.canMove(tx, ty)) { sci.x = tx; sci.y = ty; }
             }
          }
        }
      }

      sci.x = Math.max(0, Math.min(this.grid.width, sci.x)); sci.y = Math.max(0, Math.min(this.grid.height, sci.y));
      sci.vx = sci.x - prevX; sci.vy = sci.y - prevY;
    }

    // Update Clones
    for (let i = this.clones.length - 1; i >= 0; i--) {
      const clone = this.clones[i];
      let prevX = clone.x; let prevY = clone.y;

      if (clone.attackTimer > 0) {
         clone.attackTimer--;
         clone.isAttacking = true;
      } else {
         clone.isAttacking = false;
      }

      // Movement
      if (clone.manningTowerId) {
         const tower = this.towers.get(clone.manningTowerId);
         if (tower) {
            // Walk to tower
            const targetX = tower.x + 0.5;
            const targetY = tower.y + 0.5;
            const distToTower = Math.sqrt(Math.pow(targetX - clone.x, 2) + Math.pow(targetY - clone.y, 2));
            if (distToTower > 0.1) {
                if (!clone.path || clone.path.length === 0 || Math.random() < 0.05) {
                   const path = this.grid.findPath(Math.floor(clone.x), Math.floor(clone.y), tower.x, tower.y);
                   clone.path = path || [];
                }
                if (clone.path && clone.path.length > 0) {
                   const nextTarget = clone.path[0];
                   const ntx = nextTarget.x + 0.5; const nty = nextTarget.y + 0.5;
                   const pdx = ntx - clone.x; const pdy = nty - clone.y;
                   const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                   if (pdist <= clone.speed) { clone.x = ntx; clone.y = nty; clone.path.shift(); }
                   else { clone.x += (pdx / pdist) * clone.speed; clone.y += (pdy / pdist) * clone.speed; }
                } else {
                   // A* failed or reached end but not exact center. Direct move if close.
                   const dx = targetX - clone.x; const dy = targetY - clone.y;
                   const dist = Math.sqrt(dx * dx + dy * dy);
                   if (dist <= clone.speed) { clone.x = targetX; clone.y = targetY; }
                   else { clone.x += (dx / dist) * clone.speed; clone.y += (dy / dist) * clone.speed; }
                }
            } else {
                clone.x = targetX; clone.y = targetY; // Locked in
            }
         } else {
            clone.manningTowerId = null; // Tower died
            clone.path = [];
         }
      } else {
          // Patrol logic
          const distToTarget = Math.sqrt(Math.pow(clone.targetX - clone.x, 2) + Math.pow(clone.targetY - clone.y, 2));
          if (distToTarget > 0.5) {
             if (!clone.path || clone.path.length === 0 || Math.random() < 0.05) {
                 const path = this.grid.findPath(Math.floor(clone.x), Math.floor(clone.y), Math.floor(clone.targetX), Math.floor(clone.targetY));
                 clone.path = path || [];
                 if (!path) {
                    // Pick new target if blocked
                    clone.targetX = this.portalX + 0.5 + (Math.random() - 0.5) * 6;
                    clone.targetY = this.portalY + 0.5 + (Math.random() - 0.5) * 6;
                 }
             }
             if (clone.path && clone.path.length > 0) {
                 const nextTarget = clone.path[0];
                 const ntx = nextTarget.x + 0.5; const nty = nextTarget.y + 0.5;
                 const pdx = ntx - clone.x; const pdy = nty - clone.y;
                 const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                 if (pdist <= clone.speed) { clone.x = ntx; clone.y = nty; clone.path.shift(); }
                 else { clone.x += (pdx / pdist) * clone.speed; clone.y += (pdy / pdist) * clone.speed; }
             }
          } else {
             clone.targetX = this.portalX + 0.5 + (Math.random() - 0.5) * 6;
             clone.targetY = this.portalY + 0.5 + (Math.random() - 0.5) * 6;
             clone.targetX = Math.max(0, Math.min(this.grid.width, clone.targetX));
             clone.targetY = Math.max(0, Math.min(this.grid.height, clone.targetY));
             clone.path = [];
          }
      }

      clone.x = Math.max(0, Math.min(this.grid.width, clone.x)); clone.y = Math.max(0, Math.min(this.grid.height, clone.y));
      clone.vx = clone.x - prevX; clone.vy = clone.y - prevY;

      // Shooting logic (Only if not manning a tower, manned towers shoot for them)
      if (!clone.manningTowerId && this.tickCount - clone.lastFired >= this.cloneFireRate) {
        let target: Enemy | null = null; let minDist = 4;
        for (const enemy of this.enemies) {
          const edist = Math.sqrt(Math.pow(clone.x - enemy.x, 2) + Math.pow(clone.y - enemy.y, 2));
          if (edist <= 4 && edist < minDist) { minDist = edist; target = enemy; }
        }
        if (target) {
          this.projectiles.push({
            id: randomUUID(), x: clone.x, y: clone.y, targetEnemyId: target.id,
            damage: this.cloneDamage, speed: 0.25, isEnemy: false
          });
          clone.lastFired = this.tickCount;
          clone.isAttacking = true;
          clone.attackTimer = 15;
          // Set facing direction towards target for attack animation
          clone.vx = target.x - clone.x;
          clone.vy = target.y - clone.y;
        }
      }
    }

    // Enemy collision with NPCs
    for (const enemy of this.enemies) {
      for (let i = this.scientists.length - 1; i >= 0; i--) {
        const sci = this.scientists[i];
        const dist = Math.sqrt(Math.pow(enemy.x - sci.x, 2) + Math.pow(enemy.y - sci.y, 2));
        if (dist < 0.6) {
           sci.health -= (enemy.type === EnemyType.BRUTE ? 10 : 2);
           if (sci.health <= 0) this.scientists.splice(i, 1);
        }
      }
      for (let i = this.clones.length - 1; i >= 0; i--) {
        const clone = this.clones[i];
        const dist = Math.sqrt(Math.pow(enemy.x - clone.x, 2) + Math.pow(enemy.y - clone.y, 2));
        if (dist < 0.6) {
           clone.health -= (enemy.type === EnemyType.BRUTE ? 10 : 2);

           if (clone.health <= 0) {
             if (clone.manningTowerId) {
                const tower = this.towers.get(clone.manningTowerId);
                if (tower) {
                   tower.mannedByCloneId = null;
                   tower.type = TowerType.REINFORCED_BLOCKADE;
                }
             }
             this.clones.splice(i, 1);
           }

        }
      }
    }
  }

  getState() {
    return {
      id: this.id, bank: this.bank, baseHealth: this.baseHealth,
      wave: this.wave, waveTimer: this.waveTimer, isGameOver: this.isGameOver,
      enemies: this.enemies, towers: Array.from(this.towers.values()), projectiles: this.projectiles,
      scientists: this.scientists, clones: this.clones,
      portalX: this.portalX, portalY: this.portalY,
      insurancePolicyCost: this.insurancePolicyCost
    };
  }
}
