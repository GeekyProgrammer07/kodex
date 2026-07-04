import jwt from "jsonwebtoken";

export type JwtPayload = {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET environment variable is not set");
  return secret;
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}

export function signToken(
  payload: Omit<JwtPayload, "iat" | "exp">,
  expiresIn = "7d"
): string {
  return jwt.sign(payload, getSecret(), { expiresIn } as jwt.SignOptions);
}

export function extractBearerToken(authHeader: string): string {
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Invalid authorization header — expected 'Bearer <token>'");
  }
  return authHeader.slice(7);
}
