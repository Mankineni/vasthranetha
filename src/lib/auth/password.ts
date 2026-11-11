import { hash, verify } from '@node-rs/argon2'

// Argon2id with the library's defaults (19 MiB memory, 2 passes): about 50 ms
// per check on the server, cheap for two owners and slow for guessing.
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain)
}

/** False for a wrong password and for a stored value that is not a valid hash. */
export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  try {
    return await verify(stored, plain)
  } catch {
    return false
  }
}
