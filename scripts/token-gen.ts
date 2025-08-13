import { createHmac, randomBytes } from "node:crypto";

const SECRET = process.env.HMAC_KEY || "CHANGE_ME";
const payload = {
  v: 1,
  src: "chatgpt",
  model: "gpt-5-browser",
  pid: "pricing_faq_us",
  geo: "us",
  exp: Math.floor(Date.now() / 1000) + 3600
};

const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
const sig = createHmac("sha256", SECRET).update(b64).digest("base64url");
console.log(`${b64}.${sig}`);
