import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? "info",
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,name",
          messageFormat: "[{name}] {msg}",
        },
      },
    }),
  });
}

export type Logger = ReturnType<typeof createLogger>;
