'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export interface MessageContentBlock {
  type: 'text' | 'markdown' | 'citation'
  text?: string
  label?: string
  url?: string
}

interface MessageBodyRendererProps {
  content: string
  contentType?: 'plain' | 'markdown' | 'structured'
  contentBlocks?: MessageContentBlock[]
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|\*\*|(^|\n)\s*[-*]\s|\[[^\]]+\]\([^)]+\)|```/m.test(text)
}

function MarkdownBody({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-headings:text-zinc-900 prose-p:my-2 prose-li:my-1 dark:prose-invert max-w-none break-words text-zinc-800 dark:text-zinc-100">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          pre: ({ ...props }) => (
            <pre
              {...props}
              className="max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-zinc-100 p-3 dark:bg-zinc-800"
            />
          ),
          code: ({ ...props }) => (
            <code
              {...props}
              className="whitespace-pre-wrap break-words rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800"
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
  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
}

export function MessageBodyRenderer({
  content,
  contentType,
  contentBlocks,
}: MessageBodyRendererProps) {
  if (contentBlocks && contentBlocks.length > 0) {
    return (
      <div className="space-y-2">
        {contentBlocks.map((block, index) => {
          if (block.type === 'markdown' && block.text) {
            return <MarkdownBody key={`block-md-${index}`} text={block.text} />
          }
          if (block.type === 'citation' && block.label) {
            return block.url ? (
              <a
                key={`block-cite-${index}`}
                href={block.url}
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 dark:text-brand-400 text-sm underline"
              >
                {block.label}
              </a>
            ) : (
              <p key={`block-cite-${index}`} className="text-sm text-zinc-600 dark:text-zinc-300">
                {block.label}
              </p>
            )
          }
          return <PlainBody key={`block-text-${index}`} text={block.text ?? ''} />
        })}
      </div>
    )
  }

  if (contentType === 'markdown') {
    return <MarkdownBody text={content} />
  }

  if (contentType === 'structured' && looksLikeMarkdown(content)) {
    return <MarkdownBody text={content} />
  }

  if (!contentType && looksLikeMarkdown(content)) {
    return <MarkdownBody text={content} />
  }

  return <PlainBody text={content} />
}
