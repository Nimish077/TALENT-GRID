import { parseCookies } from "../utils/cookies.js";

export function cookieParser(req, res, next) {
  req.cookies = parseCookies(req.get("cookie"));
  next();
}
