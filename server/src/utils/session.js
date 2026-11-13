
import "dotenv/config";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error("JWT_SECRET must have at least 32 bytes");
}

const production = process.env.NODE_ENV === "production";

export const COOKIE_NAME = production
  ? "__Host-rsm_session"
  : "rsm_session";

export const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

export function createSessionToken(user) {
  return jwt.sign(
    {
      sv: user.session_version,
    },
    secret,
    {
      algorithm: "HS256",
      subject: String(user.id),
      issuer: "restaurant-stock-manager",
      audience: "restaurant-web",
      expiresIn: "8h",
    }
  );
}

export function verifySessionToken(token) {
  return jwt.verify(token, secret, {
    algorithms: ["HS256"],
    issuer: "restaurant-stock-manager",
    audience: "restaurant-web",
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export const clearCookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "lax",
  path: "/",
};
