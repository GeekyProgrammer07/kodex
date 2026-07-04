import { prisma } from "@kodex/db";
import { createLogger } from "@kodex/logger";

const logger = createLogger("chat-service:batcher");

type MessageInput = {
  id: string;
  content: string;
  senderId: string;
  roomId: string;
  createdAt: Date;
};

class MessageBatcher {
  private queue: MessageInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly FLUSH_INTERVAL_MS = 5_000;
  private readonly MAX_BATCH_SIZE = 50;

  start(): void {
    this.timer = setInterval(() => {
      this.flush().catch((err) =>
        logger.error({ err }, "Scheduled flush failed")
      );
    }, this.FLUSH_INTERVAL_MS);
    if (this.timer.unref) this.timer.unref();
  }

  enqueue(message: MessageInput): void {
    this.queue.push(message);
    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      logger.debug({ size: this.queue.length }, "Batch size reached, flushing early");
      this.flush().catch((err) =>
        logger.error({ err }, "Batch flush failed")
      );
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    try {
      await prisma.message.createMany({ data: batch });
      logger.debug({ count: batch.length }, "Flushed messages to DB");
    } catch (err) {
      logger.error({ err, count: batch.length }, "DB write failed, re-queuing messages");
      this.queue.unshift(...batch);
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const messageBatcher = new MessageBatcher();
