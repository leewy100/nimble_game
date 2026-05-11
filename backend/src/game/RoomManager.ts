import { GameRoom } from './GameRoom';

export class RoomManager {
  private rooms: Map<string, GameRoom>;

  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId: string): GameRoom {
    const room = new GameRoom(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  getRoomsMap(): Map<string, GameRoom> {
    return this.rooms;
  }
}
