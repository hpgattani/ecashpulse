import type { Request, Response } from "express";
import * as ed25519 from "@noble/ed25519";

/* 🔑 PayButton public key */
const PAYBUTTON_PUBLIC_KEY = "302a300506032b6570032100bc0ff6268e2edb1232563603904e40af377243cd806372e427bd05f70bd1759a";

/* helpers */
function hexToBytes(hex: string) {
  return Uint8Array.from(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

function extractKey(derHex: string) {
  return hexToBytes(derHex.slice(-64));
}

/* endpoint */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const signature = req.headers["x-paybutton-signature"] as string;

  if (!signature) {
    return res.status(401).send("Missing signature");
  }

  const rawBody = JSON.stringify(req.body);

  const valid = await ed25519.verifyAsync(
    hexToBytes(signature),
    new TextEncoder().encode(rawBody),
    extractKey(PAYBUTTON_PUBLIC_KEY),
  );

  if (!valid) {
    return res.status(401).send("Invalid signature");
  }

  /* ✅ THIS IS SERVER VERIFICATION */
  return res.status(200).json({ ok: true });
}
