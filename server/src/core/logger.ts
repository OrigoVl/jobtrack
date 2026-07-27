// Централізований pino-логер. У dev — людяний вивід через pino-pretty,
// у prod — структурований JSON (легко парситься лог-агрегаторами).
import pino from "pino";
import { env } from "../config/env.js";

const logger = pino({
  level: env.logLevel,
  transport: env.isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});

export default logger;
