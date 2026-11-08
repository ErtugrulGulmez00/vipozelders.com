import { randomInt } from "node:crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Kısa, okunabilir kayıt kodu: "GD-AB12CD" */
export function newCode(prefix: string) {
  let code = `${prefix}-`;
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}
