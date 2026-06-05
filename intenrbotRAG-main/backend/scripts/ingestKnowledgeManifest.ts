import fs from 'node:fs'
import path from 'node:path'
import { IngestKnowledgeDocument } from '../src/application/knowledge/ingestKnowledgeDocument'
import { parseFaqSections } from '../src/application/knowledge/parseFaqSections'
import { SupabaseKnowledgeRepository } from '../src/infrastructure/retrieval/supabaseKnowledgeRepository'
import { GeminiEmbeddingProvider } from '../src/infrastructure/ai/geminiEmbeddingProvider'

interface ManifestDocument {
  title: string
  section: string
  sourceUrl: string
  contentFile: string
  optional?: boolean
}

interface KnowledgeManifest {
  feature: string
  faq?: {
    contentFile: string
    title: string
    sourceUrl: string
  }
  documents: ManifestDocument[]
}

function loadEnvFromBackendDotenv(): void {
  const envPath = path.resolve(__dirname, '../.env')
  if (!fs.existsSync(envPath)) return

  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv: string[]): { replaceFeature?: string } {
  const replaceIdx = argv.indexOf('--replace-feature')
  if (replaceIdx === -1) return {}
  const feature = argv[replaceIdx + 1]
  if (!feature) {
    throw new Error('--replace-feature requires a feature name (e.g. faq-rag)')
  }
  return { replaceFeature: feature }
}

function readContentFile(dataDir: string, relativePath: string): string {
  const filePath = path.resolve(dataDir, relativePath)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing content file: ${filePath}`)
  }
  const content = fs.readFileSync(filePath, 'utf8').trim()
  if (!content) {
    throw new Error(`Content file is empty: ${filePath}`)
  }
  return content
}

async function main(): Promise<void> {
  loadEnvFromBackendDotenv()
  const { replaceFeature } = parseArgs(process.argv.slice(2))

  const dataDir = path.resolve(__dirname, '../data')
  const manifestPath = path.join(dataDir, 'knowledge-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing manifest: ${manifestPath}`)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as KnowledgeManifest
  const repository = new SupabaseKnowledgeRepository()
  const ingest = new IngestKnowledgeDocument({
    repository,
    embeddingProvider: new GeminiEmbeddingProvider(),
  })

  if (replaceFeature) {
    const deleted = await repository.deleteDocumentsByFeature(replaceFeature)
    console.log(`Deleted ${deleted} existing document(s) for feature=${replaceFeature}`)
  }

  const feature = manifest.feature
  let ingested = 0

  if (manifest.faq) {
    const faqRaw = readContentFile(dataDir, manifest.faq.contentFile)
    const sections = parseFaqSections(faqRaw)
    for (const section of sections) {
      const doc = await ingest.execute({
        feature,
        title: manifest.faq.title,
        section: section.section,
        sourceUrl: manifest.faq.sourceUrl,
        content: section.content,
      })
      ingested += 1
      console.log(`Ingested FAQ section id=${doc.id} section="${section.section}"`)
    }
  }

  for (const entry of manifest.documents) {
    const filePath = path.resolve(dataDir, entry.contentFile)
    if (!fs.existsSync(filePath)) {
      if (entry.optional) {
        console.log(`Skipping optional (not found): ${entry.contentFile}`)
        continue
      }
      throw new Error(`Missing content file: ${filePath}`)
    }

    const content = readContentFile(dataDir, entry.contentFile)
    const doc = await ingest.execute({
      feature,
      title: entry.title,
      section: entry.section,
      sourceUrl: entry.sourceUrl,
      content,
    })
    ingested += 1
    console.log(`Ingested id=${doc.id} title="${entry.title}" section="${entry.section}"`)
  }

  console.log(`Done. Ingested ${ingested} document(s) for feature=${feature}.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
