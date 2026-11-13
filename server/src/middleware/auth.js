
import User from "../models/User.js";

import {
  COOKIE_NAME,
  verifySessionToken,
} from "../utils/session.js";

export async function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      message: "Please log in",
    });
  }

  let payload;

  try {
    payload = verifySessionToken(token);
  } catch {
    return res.status(401).json({
      message: "Session expired or invalid",
    });
  }

  if (
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !/^[1-9]\d*$/.test(payload.sub) ||
    !Number.isInteger(payload.sv)
  ) {
    return res.status(401).json({
      message: "Invalid session",
    });
  }

  try {
    const user = await User.findByPk(payload.sub);

    if (
      !user ||
      !user.is_active ||
      user.session_version !== payload.sv
    ) {
      return res.status(401).json({
        message: "Session is no longer valid",
      });
    }

    // Make the authenticated user available to the route.
    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function allowRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Please log in",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission",
      });
    }

    return next();
  };
}
