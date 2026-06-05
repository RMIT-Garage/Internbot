import fs from 'node:fs'
import path from 'node:path'

const SCRAPE_TARGETS = [
  {
    slug: 'internships-work-experience-wil',
    url: 'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
    title: 'RMIT Internships, work experience and WIL',
  },
  {
    slug: 'course-guide-056999',
    url: 'https://www.rmit.edu.au/study-with-us/levels-of-study/course-guides/056/056999',
    title: 'Internship 2a (056999)',
  },
  {
    slug: 'course-guide-056997',
    url: 'https://www.rmit.edu.au/study-with-us/levels-of-study/course-guides/056/056997',
    title: 'Internship Reflection 1 (056997)',
  },
  {
    slug: 'handbook-057002',
    url: 'https://handbook.rmit.edu.au/ords/r/rmit/catalogue/course?p6_code=057002',
    title: 'Internship 2b (057002)',
  },
] as const

const USER_AGENT = 'InternbotRAG-KnowledgeBot/1.0 (one-time educational ingest)'
const DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function htmlToText(html: string): string {
  let text = html
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  text = text.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  text = text.replace(/[ \t]{2,}/g, ' ')
  return text.trim()
}

function extractPageTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match?.[1]) return undefined
  return htmlToText(match[1]).slice(0, 200)
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

async function main(): Promise<void> {
  const outDir = path.resolve(__dirname, '../data/scraped')
  fs.mkdirSync(outDir, { recursive: true })

  for (let i = 0; i < SCRAPE_TARGETS.length; i++) {
    const target = SCRAPE_TARGETS[i]!
    if (i > 0) await sleep(DELAY_MS)

    console.log(`Fetching ${target.url} ...`)
    const html = await fetchPage(target.url)
    const text = htmlToText(html)
    if (text.length < 100) {
      throw new Error(`Extracted text too short for ${target.slug} (${text.length} chars)`)
    }

    const pageTitle = extractPageTitle(html) ?? target.title
    const txtPath = path.join(outDir, `${target.slug}.txt`)
    const metaPath = path.join(outDir, `${target.slug}.meta.json`)

    fs.writeFileSync(txtPath, text, 'utf8')
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          url: target.url,
          title: pageTitle,
          slug: target.slug,
          fetchedAt: new Date().toISOString(),
          charCount: text.length,
        },
        null,
        2
      ),
      'utf8'
    )

    console.log(`  Wrote ${txtPath} (${text.length} chars)`)
  }

  console.log('Done. Review backend/data/scraped/ then run ingest:knowledge.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
