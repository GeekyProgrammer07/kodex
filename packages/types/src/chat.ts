import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const RoomTypeSchema = z.enum(["PUBLIC", "DIRECT", "PRIVATE"]);
export type RoomType = z.infer<typeof RoomTypeSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  type: RoomTypeSchema,
  createdAt: z.coerce.date(),
});
export type Room = z.infer<typeof RoomSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  senderId: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
});
export type Message = z.infer<typeof MessageSchema>;

// Events sent FROM CLIENT → server
export const WsClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("join_room"), roomId: z.string() }),
  z.object({ type: z.literal("leave_room"), roomId: z.string() }),
  z.object({
    type: z.literal("send_message"),
    roomId: z.string(),
    content: z.string().min(1).max(4000),
  }),
]);
export type WsClientEvent = z.infer<typeof WsClientEventSchema>;

// Events sent FROM SERVER → client
export const WsServerEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("message"), message: MessageSchema }),
  z.object({ type: z.literal("user_joined"), roomId: z.string(), user: UserSchema }),
  z.object({ type: z.literal("user_left"), roomId: z.string(), userId: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type WsServerEvent = z.infer<typeof WsServerEventSchema>;
