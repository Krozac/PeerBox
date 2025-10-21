// tokenUtil.js
// Works in both Node and Browser

// --- Small helper for base64 url-safe encoding ---
function base64urlEncode(str) {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

// --- Hashing (HMAC-SHA256) ---
async function hmacSHA256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return base64urlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

// --- Tokenize ---
export async function tokenise(secret, params) {
  const payload = JSON.stringify(params);
  const payloadB64 = base64urlEncode(payload);
  const sig = await hmacSHA256(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

// --- Detokenise ---
export async function detokenise(secret, token) {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) throw new Error("Invalid token format");

  const expectedSig = await hmacSHA256(secret, payloadB64);
  if (sig !== expectedSig) throw new Error("Invalid token signature");

  const json = base64urlDecode(payloadB64);
  return JSON.parse(json);
}

