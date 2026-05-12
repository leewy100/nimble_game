import './style.css';
import { io, Socket } from 'socket.io-client';
import { initGameRenderer } from './gameRenderer';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let currentRoomId: string | null = null;

const appDiv = document.querySelector<HTMLDivElement>('#app')!;

function renderMainMenu() {
  appDiv.innerHTML = `
    <div style="text-align: center; margin-top: 50px;">
      <h1>Experimental Defense</h1>
      <button id="createRoomBtn" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Create New Room</button>
      <br><br>
      <div>
        <input type="text" id="joinRoomInput" placeholder="Room ID" style="padding: 10px; font-size: 16px;" />
        <button id="joinRoomBtn" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Join Room</button>
      </div>
    </div>
  `;

  document.getElementById('createRoomBtn')!.addEventListener('click', async () => {
    const res = await fetch(`${API_URL}/api/rooms`, { method: 'POST' });
    const data = await res.json();
    joinRoom(data.roomId);
  });

  document.getElementById('joinRoomBtn')!.addEventListener('click', async () => {
    const input = document.getElementById('joinRoomInput') as HTMLInputElement;
    const roomId = input.value.trim();
    if (roomId) {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
      if (res.ok) {
        joinRoom(roomId);
      } else {
        alert('Room not found');
      }
    }
  });
}

function joinRoom(roomId: string) {
  currentRoomId = roomId;

  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Connected to server');
    socket!.emit('join_room', roomId);
  });

  renderGameRoom();
  const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  initGameRenderer(canvas, socket);
}

function renderGameRoom() {
  appDiv.innerHTML = `
    <style>
      .tower-btn { padding: 8px 16px; cursor: pointer; background: #333; color: white; border: 1px solid #555; }
      .tower-btn.active { background: #3498db; border-color: #2980b9; }
      .upgrade-btn { padding: 4px 8px; cursor: pointer; background: #2ecc71; color: white; border: none; font-size: 12px; margin-right: 5px; }
    </style>
    <div style="display: flex; flex-direction: column; align-items: center; background: #111; color: white; min-height: 100vh;">
      <div style="padding: 10px; width: 800px; display: flex; justify-content: space-between; align-items: center;">
        <span>Room: <b>${currentRoomId}</b></span>
        <span id="waveDisplay">Wave: 0</span>
        <span>Bank: $<span id="bankDisplay" style="color:#f1c40f;">0</span></span>
        <span>Base: <span id="healthDisplay" style="color:#e74c3c;">0</span></span>
      </div>

      <div style="width: 800px; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div style="display: flex; gap: 10px;">
          <button id="btn-SCIENTIST" class="tower-btn active" onclick="selectTowerType('SCIENTIST')">Scientist ($30)</button>
          <button id="btn-REINFORCEMENT" class="tower-btn" onclick="selectTowerType('REINFORCEMENT')">Blockade ($50)</button>
          <button id="btn-SELECT" class="tower-btn" onclick="selectTowerType('SELECT')">Select (Upgrade)</button>
        </div>

        <div id="upgradePanel" style="display: none; background: #222; padding: 10px; border: 1px solid #555;">
          <span style="font-size: 14px; margin-right: 10px;">Upgrades ($40 ea):</span>
          <button class="upgrade-btn" onclick="upgradeTower('damage')">+Dmg</button>
          <button class="upgrade-btn" onclick="upgradeTower('speed')">+Speed</button>
          <button class="upgrade-btn" onclick="upgradeTower('range')">+Range</button>
          <button class="upgrade-btn" onclick="upgradeTower('armor')">+Armor</button>
        </div>
      </div>

      <canvas id="gameCanvas" width="800" height="600" style="border: 1px solid #444; background: #222; cursor: crosshair;"></canvas>
    </div>
  `;
}

renderMainMenu();
