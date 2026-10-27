import type { CookieOptions, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { ENV } from "./env";

export const EDITOR_COOKIE_NAME = "the_point_editor_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;
const cookieOptions: CookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "none",
  secure: true,
};

function secretKey() {
  const secret = ENV.cookieSecret || ENV.editorPassword;
  if (!secret) throw new Error("Editor session secret is unavailable");
  return new TextEncoder().encode(secret);
}

export function editorPasswordMatches(password: string) {
  const expected = ENV.editorPassword;
  if (!expected || !password) return false;
  const actualDigest = createHmac("sha256", secretKey()).update(password).digest();
  const expectedDigest = createHmac("sha256", secretKey()).update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export async function createEditorSession() {
  return new SignJWT({ kind: "restricted-editor", name: "The Point Editor" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function isEditorSession(token?: string | null) {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.kind === "restricted-editor";
  } catch {
    return false;
  }
}

export function setEditorSession(res: Response, token: string) {
  res.cookie(EDITOR_COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearEditorSession(res: Response) {
  res.clearCookie(EDITOR_COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
}

export function getEditorSessionToken(req: Request) {
  const header = req.headers.cookie ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${EDITOR_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}
