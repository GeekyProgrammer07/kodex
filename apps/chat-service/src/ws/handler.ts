import type { IncomingMessage } from "http";
import WebSocket from "ws";
import { verifyToken, extractBearerToken } from "@kodex/auth";
import { WsClientEventSchema, type WsServerEvent } from "@kodex/types/chat";
import { prisma } from "@kodex/db";
import { createLogger } from "@kodex/logger";
import {
  type AuthenticatedSocket,
  joinRoom,
  leaveRoom,
  leaveAllRooms,
  broadcastToRoom,
} from "./rooms.js";
import { messageBatcher } from "./batcher.js";

const logger = createLogger("chat-service:ws");
const HEARTBEAT_INTERVAL_MS = 30_000;

function send(socket: WebSocket, event: WsServerEvent): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

export function handleConnection(
  rawSocket: WebSocket,
  req: IncomingMessage
): void {
  const socket = rawSocket as AuthenticatedSocket;

  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = extractBearerToken(authHeader);
    const payload = verifyToken(token);
    socket.userId = payload.userId;
    socket.username = payload.username;
  } catch (err) {
    logger.warn({ err }, "WS connection rejected — unauthorized");
    send(socket, { type: "error", message: "Unauthorized" });
    socket.close(1008, "Unauthorized");
    return;
  }

  logger.info({ userId: socket.userId, username: socket.username }, "Client connected");
  socket.isAlive = true;

  const heartbeat = setInterval(() => {
    if (!socket.isAlive) {
      logger.warn({ userId: socket.userId }, "Heartbeat timeout, terminating connection");
      socket.terminate();
      return;
    }
    socket.isAlive = false;
    socket.ping();
  }, HEARTBEAT_INTERVAL_MS);

  socket.on("pong", () => {
    socket.isAlive = true;
  });

  socket.on("message", async (data) => {
    let parsed;
    try {
      parsed = WsClientEventSchema.safeParse(JSON.parse(data.toString()));
    } catch {
      send(socket, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (!parsed.success) {
      send(socket, { type: "error", message: "Invalid event format" });
      return;
    }

    const event = parsed.data;

    if (event.type === "join_room") {
      const room = await prisma.room.findUnique({ where: { id: event.roomId } });
      if (!room) {
        send(socket, { type: "error", message: "Room not found" });
        return;
      }
      joinRoom(event.roomId, socket);
      logger.info({ userId: socket.userId, roomId: event.roomId }, "User joined room");
      broadcastToRoom(
        event.roomId,
        {
          type: "user_joined",
          roomId: event.roomId,
          user: { id: socket.userId, username: socket.username },
        } satisfies WsServerEvent,
        socket
      );
    }

    if (event.type === "leave_room") {
      leaveRoom(event.roomId, socket);
      logger.info({ userId: socket.userId, roomId: event.roomId }, "User left room");
      broadcastToRoom(event.roomId, {
        type: "user_left",
        roomId: event.roomId,
        userId: socket.userId,
      } satisfies WsServerEvent);
    }

    if (event.type === "send_message") {
      const messageId = crypto.randomUUID();
      const createdAt = new Date();
      logger.debug({ userId: socket.userId, roomId: event.roomId, messageId }, "Message queued");
      messageBatcher.enqueue({
        id: messageId,
        content: event.content,
        senderId: socket.userId,
        roomId: event.roomId,
        createdAt,
      });
      broadcastToRoom(event.roomId, {
        type: "message",
        message: {
          id: messageId,
          content: event.content,
          senderId: socket.userId,
          roomId: event.roomId,
          createdAt,
        },
      } satisfies WsServerEvent);
    }
  });

  socket.on("close", (code, reason) => {
    clearInterval(heartbeat);
    const leftRooms = leaveAllRooms(socket);
    logger.info(
      { userId: socket.userId, code, reason: reason.toString(), roomsLeft: leftRooms.length },
      "Client disconnected"
    );
    for (const roomId of leftRooms) {
      broadcastToRoom(roomId, {
        type: "user_left",
        roomId,
        userId: socket.userId,
      } satisfies WsServerEvent);
    }
  });

  socket.on("error", (err) => {
    logger.error({ err, userId: socket.userId }, "Socket error");
  });
}
