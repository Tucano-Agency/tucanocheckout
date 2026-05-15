import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "tucano_admin_session";
const MAX_AGE_SEC = 60 * 60 * 12;

type SessionPayload = {
  readonly tenantSlug: string;
  readonly exp: number;
};

function secret(): string {
  const s = process.env.TUCANO_ADMIN_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "TUCANO_ADMIN_SECRET ausente ou muito curto (mín. 16 caracteres).",
    );
  }
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createAdminSessionToken(tenantSlug: string): string {
  const payload: SessionPayload = {
    tenantSlug,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifyAdminSessionToken(
  token: string,
): SessionPayload | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.tenantSlug || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export async function setAdminSessionCookie(tenantSlug: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createAdminSessionToken(tenantSlug), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
