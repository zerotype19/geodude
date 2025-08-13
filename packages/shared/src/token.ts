export async function verifyToken(token: string, secret: string) {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) throw new Error("bad token format");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(b64)
  );
  const esig = btoa(String.fromCharCode(...new Uint8Array(mac)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/,"");
  if (esig !== sig) throw new Error("bad signature");
  const payload = JSON.parse(atob(b64));
  if (payload.exp && Date.now()/1000 > payload.exp) throw new Error("expired");
  return payload as Record<string, unknown>;
}
