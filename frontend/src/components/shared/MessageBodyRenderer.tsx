'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface ContentBlock {
  type: 'text' | 'markdown' | 'citation'
  text?: string
  label?: string
  url?: string
}

interface Props {
  content: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: ContentBlock[]
}

function MarkdownBody({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-headings:font-semibold prose-headings:text-zinc-900 prose-p:my-1.5 prose-li:my-0.5 prose-strong:text-zinc-900 prose-a:text-red-700 prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs prose-pre:bg-zinc-100 prose-pre:rounded-lg max-w-none break-words text-zinc-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: ({ ...props }) => (
            <pre
              {...props}
              className="max-w-full overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs break-words whitespace-pre-wrap"
            />
          ),
          code: ({ ...props }) => (
            <code
              {...props}
              className="rounded bg-zinc-100 px-1 py-0.5 text-xs break-words whitespace-pre-wrap"
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

function PlainBody({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-700">{text}</p>
  )
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|\*\*|(^|\n)\s*[-*]\s|\[[^\]]+\]\([^)]+\)|```/m.test(text)
}

export function MessageBodyRenderer({ content, contentType, contentBlocks }: Props) {
  if (contentBlocks && contentBlocks.length > 0) {
    return (
      <div className="space-y-2">
        {contentBlocks.map((block, i) => {
          if (block.type === 'markdown' && block.text) {
            return <MarkdownBody key={i} text={block.text} />
          }
          if (block.type === 'citation' && block.label) {
            return block.url ? (
              <a
                key={i}
                href={block.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-red-700 underline"
              >
                {block.label}
              </a>
            ) : (
              <p key={i} className="text-sm text-zinc-500">
                {block.label}
              </p>
            )
          }
          return <PlainBody key={i} text={block.text ?? ''} />
        })}
      </div>
    )
  }

  if (contentType === 'markdown' || looksLikeMarkdown(content)) {
    return <MarkdownBody text={content} />
  }

  return <PlainBody text={content} />
}
