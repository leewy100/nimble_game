import { Socket } from 'socket.io-client';

const TILE_SIZE = 40;
const SPRITE_SIZE = 32;

export function initGameRenderer(canvas: HTMLCanvasElement, socket: Socket) {
  const ctx = canvas.getContext('2d')!;
  let gameState: any = null;
  let selectedTowerType: string = 'SCIENTIST';
  let selectedTowerId: string | null = null;
  let animationTime = 0;

  const spriteSheet = new Image();
  spriteSheet.src = '/sprites.png';

  socket.on('game_state', (state) => {
    gameState = state;
    updateUI(state);

    if (selectedTowerId && !gameState.towers.find((t: any) => t.id === selectedTowerId)) {
       selectedTowerId = null;
       document.getElementById('upgradePanel')!.style.display = 'none';
    }
  });

  canvas.addEventListener('click', (e) => {
    if (!gameState || gameState.isGameOver) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    if (selectedTowerType === 'SELECT') {
      const clickedTower = gameState.towers.find((t: any) => t.x === gridX && t.y === gridY);
      if (clickedTower) {
        selectedTowerId = clickedTower.id;
        document.getElementById('upgradePanel')!.style.display = 'block';
      } else {
        selectedTowerId = null;
        document.getElementById('upgradePanel')!.style.display = 'none';
      }
    } else {
      socket.emit('place_tower', { x: gridX, y: gridY, type: selectedTowerType });
    }
  });

  (window as any).selectTowerType = (type: string) => {
    selectedTowerType = type;
    document.querySelectorAll('.tower-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${type}`)?.classList.add('active');

    if (type !== 'SELECT') {
       selectedTowerId = null;
       document.getElementById('upgradePanel')!.style.display = 'none';
    }
  };

  (window as any).upgradeTower = (stat: string) => {
    if (selectedTowerId) {
       socket.emit('upgrade_tower', { towerId: selectedTowerId, stat });
    }
  };

  (window as any).upgradeClones = () => {
    socket.emit('upgrade_clones');
  };

  function updateUI(state: any) {
    const bankDisplay = document.getElementById('bankDisplay');
    const healthDisplay = document.getElementById('healthDisplay');
    const waveDisplay = document.getElementById('waveDisplay');
    const insuranceBtn = document.getElementById('insuranceBtn');

    if (bankDisplay) bankDisplay.innerText = state.bank;
    if (healthDisplay) healthDisplay.innerText = state.baseHealth;
    if (waveDisplay) waveDisplay.innerText = `Wave: ${state.wave} ${state.enemies.length === 0 ? '(Next in ' + Math.ceil(state.waveTimer/60) + 's)' : ''}`;
    if (insuranceBtn) insuranceBtn.innerText = `Insurance Policy ($${state.insurancePolicyCost})`;
  }

  function getDirectionRowOffset(vx: number, vy: number): number {
    if (Math.abs(vx) > Math.abs(vy)) {
      return vx > 0 ? 2 : 1; // Right : Left
    } else {
      return vy > 0 ? 0 : 3; // Down : Up
    }
  }

  function drawSprite(ctx: CanvasRenderingContext2D, baseRow: number, vx: number, vy: number, x: number, y: number, scale: number = 1) {
    if (!spriteSheet.complete || spriteSheet.width === 0) return false;

    const dirOffset = getDirectionRowOffset(vx, vy);
    const row = baseRow + dirOffset;

    const isMoving = Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001;
    const col = isMoving ? Math.floor(animationTime * 5) % 4 : 0;

    const sx = col * SPRITE_SIZE;
    const sy = row * SPRITE_SIZE;

    const size = TILE_SIZE * scale;
    ctx.drawImage(spriteSheet, sx, sy, SPRITE_SIZE, SPRITE_SIZE, x - size/2, y - size/2, size, size);
    return true;
  }

  function render() {
    animationTime += 0.05;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameState) {
      requestAnimationFrame(render);
      return;
    }

    // Draw Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += TILE_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += TILE_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Draw Portal
    const px = gameState.portalX * TILE_SIZE;
    const py = gameState.portalY * TILE_SIZE;
    const gradient = ctx.createRadialGradient(
      px + TILE_SIZE/2, py + TILE_SIZE/2, 5,
      px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/2 + Math.sin(animationTime)*5
    );
    gradient.addColorStop(0, '#9b59b6');
    gradient.addColorStop(1, 'rgba(142, 68, 173, 0.2)');
    ctx.fillStyle = gradient;
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Draw Towers
    if (gameState.towers) {
      for (const tower of gameState.towers) {
        ctx.fillStyle = tower.type === 'SCIENTIST' ? '#3498db' : '#95a5a6';
        ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);

        if (selectedTowerId === tower.id) {
           ctx.strokeStyle = '#f1c40f';
           ctx.lineWidth = 2;
           ctx.strokeRect(tower.x * TILE_SIZE, tower.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }

        const hpPercent = tower.health / tower.maxHealth;
        ctx.fillStyle = 'red';
        ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + TILE_SIZE - 6, TILE_SIZE - 4, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + TILE_SIZE - 6, (TILE_SIZE - 4) * hpPercent, 4);
      }
    }

    // Draw Scientists (Rows 16-19)
    if (gameState.scientists) {
      for (const sci of gameState.scientists) {
        const cx = sci.x * TILE_SIZE;
        const cy = sci.y * TILE_SIZE;
        if (!drawSprite(ctx, 16, sci.vx || 0, sci.vy || 0, cx, cy, 0.8)) {
           ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill(); ctx.closePath();
        }

        if (sci.phrase) {
          ctx.fillStyle = 'white';
          ctx.font = '12px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(sci.phrase, cx, cy - 20);
        }

        const hpPercent = sci.health / sci.maxHealth;
        ctx.fillStyle = 'red';
        ctx.fillRect(cx - 10, cy - 15, 20, 3);
        ctx.fillStyle = 'green';
        ctx.fillRect(cx - 10, cy - 15, 20 * hpPercent, 3);
      }
    }

    // Draw Clones (Rows 0-3)
    if (gameState.clones) {
      for (const clone of gameState.clones) {
        const cx = clone.x * TILE_SIZE;
        const cy = clone.y * TILE_SIZE;
        if (!drawSprite(ctx, 0, clone.vx || 0, clone.vy || 0, cx, cy, 0.8)) {
           ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fillStyle = 'yellow'; ctx.fill(); ctx.closePath();
        }

        const hpPercent = clone.health / clone.maxHealth;
        ctx.fillStyle = 'red';
        ctx.fillRect(cx - 10, cy - 15, 20, 3);
        ctx.fillStyle = 'green';
        ctx.fillRect(cx - 10, cy - 15, 20 * hpPercent, 3);
      }
    }

    // Draw Enemies (Rows 8-11)
    if (gameState.enemies) {
      for (const enemy of gameState.enemies) {
        const ex = enemy.x * TILE_SIZE;
        const ey = enemy.y * TILE_SIZE;

        let scale = 0.8;
        if (enemy.type === 'RUNNER') scale = 0.6;
        if (enemy.type === 'BRUTE') scale = 1.2;

        if (!drawSprite(ctx, 8, enemy.vx || 0, enemy.vy || 0, ex, ey, scale)) {
           ctx.beginPath(); ctx.arc(ex, ey, 10 * scale, 0, Math.PI * 2); ctx.fillStyle = 'orange'; ctx.fill(); ctx.closePath();
        }

        const hpPercent = enemy.health / enemy.maxHealth;
        const r = 10 * scale;
        ctx.fillStyle = 'red';
        ctx.fillRect(ex - r, ey - r - 6, r * 2, 4);
        ctx.fillStyle = 'green';
        ctx.fillRect(ex - r, ey - r - 6, (r * 2) * hpPercent, 4);
      }
    }

    // Draw Projectiles
    if (gameState.projectiles) {
      for (const proj of gameState.projectiles) {
        ctx.beginPath();
        ctx.arc(proj.x * TILE_SIZE, proj.y * TILE_SIZE, 3, 0, Math.PI * 2);
        ctx.fillStyle = proj.isEnemy ? '#e74c3c' : '#ecf0f1';
        ctx.fill();
        ctx.closePath();
      }
    }

    if (gameState.isGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'red';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
    }

    requestAnimationFrame(render);
  }

  render();
}
