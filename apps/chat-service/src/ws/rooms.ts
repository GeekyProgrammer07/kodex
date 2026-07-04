import WebSocket from "ws";

export type AuthenticatedSocket = WebSocket & {
  userId: string;
  username: string;
  isAlive: boolean;
};

// In-memory map: roomId → connected sockets in that room
const roomSockets = new Map<string, Set<AuthenticatedSocket>>();

export function joinRoom(roomId: string, socket: AuthenticatedSocket): void {
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId)!.add(socket);
}

export function leaveRoom(roomId: string, socket: AuthenticatedSocket): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) roomSockets.delete(roomId);
}

export function leaveAllRooms(socket: AuthenticatedSocket): string[] {
  const left: string[] = [];
  for (const [roomId, sockets] of roomSockets) {
    if (sockets.has(socket)) {
      sockets.delete(socket);
      left.push(roomId);
      if (sockets.size === 0) roomSockets.delete(roomId);
    }
  }
  return left;
}

export function broadcastToRoom(
  roomId: string,
  event: object,
  excludeSocket?: AuthenticatedSocket
): void {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket !== excludeSocket && socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}
