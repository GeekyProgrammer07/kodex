import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { createLogger } from "@kodex/logger";
import { handleConnection } from "./ws/handler.js";
import { messageBatcher } from "./ws/batcher.js";
import roomsRouter from "./routes/rooms.js";
import messagesRouter from "./routes/messages.js";
import usersRouter from "./routes/users.js";

const logger = createLogger("chat-service");
const app = express();
const PORT = Number(process.env["PORT"] ?? 3005);

app.use(cors());
app.use(express.json());

app.get("/status", (_req, res) => {
  res.json({ status: "healthy", service: "chat-service", env: process.env["NODE_ENV"] ?? "development" });
});

app.use("/users", usersRouter);
app.use("/rooms", roomsRouter);
app.use("/rooms", messagesRouter);

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", handleConnection);

messageBatcher.start();

httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, "Server started");
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down, flushing message queue...");
  messageBatcher.stop();
  await messageBatcher.flush();
  httpServer.close(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
