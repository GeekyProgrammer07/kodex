import { Router, type Router as IRouter } from "express";
import { z } from "zod";
import { prisma } from "@kodex/db";
import { createLogger } from "@kodex/logger";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

const router: IRouter = Router();
const logger = createLogger("chat-service:rooms");

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

const CreateDMSchema = z.object({
  userIdA: z.string(),
  userIdB: z.string(),
});

router.get("/", async (_req, res) => {
  const rooms = await prisma.room.findMany({
    where: { type: "PUBLIC" },
    orderBy: { createdAt: "desc" },
  });
  res.json(rooms);
});

router.post("/", requireAuth, validate(CreateRoomSchema), async (req, res) => {
  const { name, type } = req.body as { name: string; type: "PUBLIC" | "PRIVATE" };
  try {
    const room = await prisma.room.create({ data: { name, type } });
    logger.info({ roomId: room.id, name, type }, "Room created");
    res.status(201).json(room);
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      logger.warn({ name }, "Room name already taken");
      res.status(409).json({ error: "Room name already taken" });
      return;
    }
    logger.error({ err, name }, "Failed to create room");
    res.status(500).json({ error: "Failed to create room" });
  }
});

router.post("/dm", requireAuth, validate(CreateDMSchema), async (req, res) => {
  const { userIdA, userIdB } = req.body as { userIdA: string; userIdB: string };

  if (userIdA === userIdB) {
    res.status(400).json({ error: "Cannot create a DM with yourself" });
    return;
  }

  const existing = await prisma.room.findFirst({
    where: {
      type: "DIRECT",
      AND: [
        { members: { some: { userId: userIdA } } },
        { members: { some: { userId: userIdB } } },
      ],
    },
    include: {
      members: true,
      _count: { select: { members: true } },
    },
  });

  if (existing && existing._count.members === 2) {
    logger.debug({ roomId: existing.id, userIdA, userIdB }, "Returning existing DM room");
    res.json(existing);
    return;
  }

  const room = await prisma.room.create({
    data: {
      type: "DIRECT",
      members: { create: [{ userId: userIdA }, { userId: userIdB }] },
    },
    include: { members: true },
  });

  logger.info({ roomId: room.id, userIdA, userIdB }, "DM room created");
  res.status(201).json(room);
});

export default router;
