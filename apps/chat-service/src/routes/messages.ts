import { Router, type Router as IRouter } from "express";
import { prisma } from "@kodex/db";

const router: IRouter = Router();

// GET /rooms/:roomId/messages?limit=50&cursor=<messageId>
// Returns messages in chronological order using keyset pagination
router.get("/:roomId/messages", async (req, res) => {
  const { roomId } = req.params;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 100);
  const cursor = req.query["cursor"] as string | undefined;

  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      sender: { select: { id: true, username: true } },
    },
  });

  res.json(messages.reverse()); // flip to chronological order for the client
});

export default router;
