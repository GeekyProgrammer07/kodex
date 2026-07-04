import type { Request, Response, NextFunction } from "express";
import { verifyToken, extractBearerToken, type JwtPayload } from "@kodex/auth";

// Augment Express Request to carry the verified JWT payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  try {
    const token = extractBearerToken(authHeader);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
