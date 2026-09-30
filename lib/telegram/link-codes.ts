import { createHash, randomBytes } from "node:crypto";

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export function generateLinkCode(): string {
  return randomBytes(24).toString("base64url");
}

/** En la base se guarda solo el hash: el código en claro vive en el link. */
export function hashLinkCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
