import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { getSharedSessionToken, isSharedSession, sharedUser } from "./sharedAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Manus OAuth is optional. Independent deployments use only the signed
  // shared-password session and must not call Manus services at all.
  if (ENV.oAuthServerUrl || ENV.appId) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  if (!user && (await isSharedSession(getSharedSessionToken(opts.req)))) {
    user = sharedUser as User;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
