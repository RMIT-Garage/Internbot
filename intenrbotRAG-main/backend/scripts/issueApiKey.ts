/**
 * Issue a new API key and store its hash in Firestore.
 *
 * Usage: pnpm run keys:issue -- --label "internbot-prod" --env live
 */
import { FirestoreApiKeyRepository } from '../src/infrastructure/apiKeys/firestoreApiKeyRepository'
import { ApiKeyService } from '../src/application/apiKeys/ApiKeyService'
import type { ApiKeyEnv } from '../src/application/ports/apiKeyRepository'

function parseArgs(argv: string[]): { label: string; env: ApiKeyEnv; platform: string } {
  let label = ''
  let env: ApiKeyEnv = 'test'
  let platform = 'internbot'

  const args = argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!
    if (!a.startsWith('--')) continue
    if (a === '--label' && args[i + 1]) {
      label = args[++i]!
      continue
    }
    if (a === '--env' && args[i + 1]) {
      const v = args[++i]!.toLowerCase()
      if (v !== 'live' && v !== 'test') {
        throw new Error(`--env must be live or test, got: ${v}`)
      }
      env = v
      continue
    }
    if (a === '--platform' && args[i + 1]) {
      platform = args[++i]!
      continue
    }
  }

  if (!label.trim()) {
    throw new Error('Missing --label (non-empty string)')
  }

  return { label: label.trim(), env, platform }
}

async function main(): Promise<void> {
  const { label, env, platform } = parseArgs(process.argv)
  const repository = new FirestoreApiKeyRepository()
  const service = new ApiKeyService(repository)
  const { plaintext, record } = await service.issue({ label, env, platform })

  // eslint-disable-next-line no-console
  console.info('API key created (store this secret once; it cannot be retrieved later):')
  // eslint-disable-next-line no-console
  console.info(plaintext)
  // eslint-disable-next-line no-console
  console.info('\nMetadata:')
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify(
      { keyHash: record.keyHash, label: record.label, env: record.env, platform: record.platform },
      null,
      2
    )
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
