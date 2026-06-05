import fs from 'node:fs'
import path from 'node:path'
import { IngestKnowledgeDocument } from '../src/application/knowledge/ingestKnowledgeDocument'
import { SupabaseKnowledgeRepository } from '../src/infrastructure/retrieval/supabaseKnowledgeRepository'
import { GeminiEmbeddingProvider } from '../src/infrastructure/ai/geminiEmbeddingProvider'

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

async function main(): Promise<void> {
  loadEnvFromBackendDotenv()

  const sourcePath = path.resolve(__dirname, '../data/faq-internship-students-cleaned.txt')
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source file: ${sourcePath}`)
  }

  const content = fs.readFileSync(sourcePath, 'utf8').trim()
  if (!content) {
    throw new Error('faq-internship-students-cleaned.txt is empty')
  }

  const useCase = new IngestKnowledgeDocument({
    repository: new SupabaseKnowledgeRepository(),
    embeddingProvider: new GeminiEmbeddingProvider(),
  })

  const document = await useCase.execute({
    feature: 'faq-rag',
    title: 'FAQ for Internship for Students',
    section: 'Student FAQ',
    sourceUrl:
      'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
    content,
  })

  console.log(
    `Ingested document id=${document.id} feature=${document.feature} title=${document.title}`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
