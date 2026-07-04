import { Router, type Router as IRouter } from "express";
import { z } from "zod";
import { prisma } from "@kodex/db";
import { signToken } from "@kodex/auth";
import { createLogger } from "@kodex/logger";
import { validate } from "../middleware/validate.js";

const router: IRouter = Router();
const logger = createLogger("chat-service:users");

const CreateUserSchema = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_-]+$/, {
    message: "Username may only contain letters, numbers, underscores and hyphens",
  }),
});

router.post("/", validate(CreateUserSchema), async (req, res) => {
  console.log(`Hey this is DB url: ${process.env.DATABASE_URL}`);
  const { username } = req.body as { username: string };
  try {
    const user = await prisma.user.create({ data: { username } });
    const token = signToken({ userId: user.id, username: user.username });
    logger.info({ userId: user.id, username }, "User created");
    res.status(201).json({ user, token });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      logger.warn({ username }, "Username already taken");
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    logger.error({ err, username }, "Failed to create user");
    res.status(500).json({ error: "Failed to create user" });
  }
});

export default router;
