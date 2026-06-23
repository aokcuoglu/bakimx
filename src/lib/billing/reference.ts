// Unambiguous alphabet (no O/0, I/1, B/8 confusion) for human-typed havale refs.
const ALPHABET = "ACDEFGHJKLMNPQRSTUVWXYZ2345679"

/** Short, unique-ish reference shown on the havale instruction. DB enforces
 *  uniqueness; callers retry on collision. */
export function generateOrderReference(): string {
  let s = ""
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return `BX-${s}`
}
