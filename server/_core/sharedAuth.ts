import type { CookieOptions, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { ENV } from "./env";

export const SHARED_COOKIE_NAME = "the_point_shared_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const cookieOptions: CookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: ENV.isProduction,
};

function secretKey() {
  const secret = ENV.cookieSecret || ENV.sharedPassword;
  if (!secret) throw new Error("Shared session secret is unavailable");
  return new TextEncoder().encode(secret);
}

function digest(value: string) {
  return createHmac("sha256", secretKey()).update(value).digest();
}

export function passwordMatches(password: string) {
  const expected = ENV.sharedPassword;
  if (!expected || !password) return false;
  const actualDigest = digest(password);
  const expectedDigest = digest(expected);
  return timingSafeEqual(actualDigest, expectedDigest);
}

export async function createSharedSession() {
  return new SignJWT({ kind: "shared-access", name: "Socios The Point" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function isSharedSession(token?: string | null) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.kind === "shared-access";
  } catch {
    return false;
  }
}

export function setSharedSession(res: Response, token: string) {
  res.cookie(SHARED_COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSharedSession(res: Response) {
  res.clearCookie(SHARED_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
}

export function getSharedSessionToken(req: Request) {
  const header = req.headers.cookie ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SHARED_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

export const sharedUser = {
  id: 0,
  openId: "shared-the-point",
  name: "Socios The Point",
  email: null,
  loginMethod: "shared-password",
  role: "admin" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(),
};
