import { Socket } from 'socket.io-client';

const TILE_SIZE = 40;

export function initGameRenderer(canvas: HTMLCanvasElement, socket: Socket) {
  const ctx = canvas.getContext('2d')!;
  let gameState: any = null;
  let selectedTowerType: string = 'SCIENTIST'; // default

  socket.on('game_state', (state) => {
    gameState = state;
    updateUI(state);
  });

  canvas.addEventListener('click', (e) => {
    if (!gameState || gameState.isGameOver) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const gridX = Math.floor(x / TILE_SIZE);
    const gridY = Math.floor(y / TILE_SIZE);

    socket.emit('place_tower', { x: gridX, y: gridY, type: selectedTowerType });
  });

  // Expose function to change tower type from UI buttons
  (window as any).selectTowerType = (type: string) => {
    selectedTowerType = type;
    document.querySelectorAll('.tower-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${type}`)?.classList.add('active');
  };

  function updateUI(state: any) {
    const bankDisplay = document.getElementById('bankDisplay');
    const healthDisplay = document.getElementById('healthDisplay');
    const waveDisplay = document.getElementById('waveDisplay');

    if (bankDisplay) bankDisplay.innerText = state.bank;
    if (healthDisplay) healthDisplay.innerText = state.baseHealth;
    if (waveDisplay) waveDisplay.innerText = `Wave: ${state.wave} ${state.enemies.length === 0 ? '(Next in ' + Math.ceil(state.waveTimer/60) + 's)' : ''}`;
  }

  function render() {
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

    // Draw Base (Bottom row visually highlighted)
    ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
    ctx.fillRect(0, canvas.height - TILE_SIZE, canvas.width, TILE_SIZE);

    // Draw Towers
    for (const tower of gameState.towers) {
      ctx.fillStyle = tower.type === 'SCIENTIST' ? '#3498db' : '#95a5a6';
      ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);

      // Health bar for tower
      const hpPercent = tower.health / tower.maxHealth;
      ctx.fillStyle = 'red';
      ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + TILE_SIZE - 6, TILE_SIZE - 4, 4);
      ctx.fillStyle = 'green';
      ctx.fillRect(tower.x * TILE_SIZE + 2, tower.y * TILE_SIZE + TILE_SIZE - 6, (TILE_SIZE - 4) * hpPercent, 4);
    }

    // Draw Enemies
    for (const enemy of gameState.enemies) {
      let color = '#e74c3c'; // Blob
      let radius = TILE_SIZE / 3;
      if (enemy.type === 'RUNNER') { color = '#f1c40f'; radius = TILE_SIZE / 4; }
      if (enemy.type === 'BRUTE') { color = '#8e44ad'; radius = TILE_SIZE / 2 - 2; }

      const px = enemy.x * TILE_SIZE;
      const py = enemy.y * TILE_SIZE;

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.closePath();

      // Health bar
      const hpPercent = enemy.health / enemy.maxHealth;
      ctx.fillStyle = 'red';
      ctx.fillRect(px - radius, py - radius - 6, radius * 2, 4);
      ctx.fillStyle = 'green';
      ctx.fillRect(px - radius, py - radius - 6, (radius * 2) * hpPercent, 4);
    }

    // Draw Projectiles
    for (const proj of gameState.projectiles) {
      ctx.beginPath();
      ctx.arc(proj.x * TILE_SIZE, proj.y * TILE_SIZE, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ecf0f1';
      ctx.fill();
      ctx.closePath();
    }

    // Draw Game Over
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
