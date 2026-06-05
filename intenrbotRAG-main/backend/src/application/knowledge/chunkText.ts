export interface TextChunk {
  text: string
  chunkIndex: number
}

const MAX_CHUNK_LENGTH = 700
const CHUNK_OVERLAP = 120

export function chunkText(content: string): TextChunk[] {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (!normalized) {
    return []
  }

  const chunks: TextChunk[] = []
  let start = 0
  let chunkIndex = 0

  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHUNK_LENGTH, normalized.length)

    if (end < normalized.length) {
      const lastSpace = normalized.lastIndexOf(' ', end)
      if (lastSpace > start + 200) {
        end = lastSpace
      }
    }

    const text = normalized.slice(start, end).trim()
    if (text) {
      chunks.push({ text, chunkIndex })
      chunkIndex += 1
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks
}
