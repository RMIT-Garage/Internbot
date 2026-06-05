/**
 * Revoke an API key by its sha256 document id (key hash).
 *
 * Usage: pnpm run keys:revoke -- <keyHashHex64>
 */
import { FirestoreApiKeyRepository } from '../src/infrastructure/apiKeys/firestoreApiKeyRepository'

async function main(): Promise<void> {
  const keyHash = process.argv
    .slice(2)
    .find((a) => /^[a-f0-9]{64}$/i.test(a.trim()))
    ?.trim()
  if (!keyHash || !/^[a-f0-9]{64}$/i.test(keyHash)) {
    throw new Error('Usage: pnpm run keys:revoke -- <keyHashHex64>')
  }

  const repository = new FirestoreApiKeyRepository()
  await repository.setRevoked(keyHash.toLowerCase(), true)
  // eslint-disable-next-line no-console
  console.info(`Revoked api_keys/${keyHash.toLowerCase()}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
