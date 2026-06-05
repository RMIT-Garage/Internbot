'use client'

import { useRef, useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { toast } from 'sonner'

interface ChatInputAreaProps {
  onSend: (
    message: string,
    fileContext?: string,
    attachment?: { mimeType: string; dataBase64: string; fileName?: string }
  ) => void
  disabled?: boolean
}

const MAX_FILE_CONTEXT_CHARS = 900_000
const MAX_FILE_SIZE_BYTES = 1_000_000

export function ChatInputArea({ onSend, disabled }: ChatInputAreaProps) {
  const [input, setInput] = useState('')
  const [fileContext, setFileContext] = useState<string | undefined>()
  const [attachment, setAttachment] = useState<
    { mimeType: string; dataBase64: string; fileName?: string } | undefined
  >()
  const [fileName, setFileName] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!input.trim() && !fileContext && !attachment) return
    onSend(input, fileContext, attachment)
    setInput('')
    setFileContext(undefined)
    setAttachment(undefined)
    setFileName(undefined)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled) handleSend()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('Attached file is too large. Please use files under 1MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setFileName(file.name)
    const reader = new FileReader()
    const isTextLike =
      file.type.startsWith('text/') || /\.(txt|md|json|csv|xml|yaml|yml|log|rtf)$/i.test(file.name)

    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result !== 'string') return

      if (isTextLike) {
        const truncated = result.length > MAX_FILE_CONTEXT_CHARS
        const normalized = truncated ? result.slice(0, MAX_FILE_CONTEXT_CHARS) : result
        setFileContext(normalized)
        setAttachment(undefined)
        if (truncated) {
          toast.info(
            `Attached ${file.name} (trimmed to first ${MAX_FILE_CONTEXT_CHARS.toLocaleString()} chars)`
          )
          return
        }
        toast.success(`Attached ${file.name}`)
        return
      }

      // Binary documents/images are forwarded as base64 so Gemini can parse multimodal content.
      const base64 = result.includes(',') ? result.split(',')[1] : undefined
      if (!base64) {
        toast.error('Failed to encode attachment')
        return
      }
      setFileContext(undefined)
      setAttachment({
        mimeType: file.type || 'application/octet-stream',
        dataBase64: base64,
        fileName: file.name,
      })
      toast.success(`Attached ${file.name} (${file.type || 'binary'})`)
    }
    reader.onerror = () => {
      toast.error('Failed to read file contents')
      setFileName(undefined)
    }
    if (isTextLike) {
      reader.readAsText(file)
    } else {
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="relative border-t bg-transparent p-3 sm:p-4">
      {fileName && (
        <div className="bg-brand-50 text-brand-900 dark:bg-brand-50/40 mb-2 flex w-fit items-center gap-2 rounded-md px-3 py-1 text-xs">
          <Paperclip className="size-3" />
          <span>Attached: {fileName}</span>
          <button
            onClick={() => {
              setFileName(undefined)
              setFileContext(undefined)
              setAttachment(undefined)
            }}
            className="ml-2 hover:text-red-500"
          >
            &times;
          </button>
        </div>
      )}
      <div className="bg-background focus-within:ring-brand-500/30 flex items-center gap-2 rounded-xl border p-1.5 shadow-sm ring-1 ring-transparent transition-shadow">
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:text-zinc-300"
        >
          <Paperclip className="size-5" />
          <input
            type="file"
            accept=".txt,.md,.json,.csv,.pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.heic"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={disabled}
          className="min-h-[36px] w-full resize-none bg-transparent py-2 text-sm leading-5 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          rows={1}
        />

        <button
          type="button"
          disabled={disabled || (!input.trim() && !fileContext && !attachment)}
          onClick={handleSend}
          className="bg-brand-500 hover:bg-brand-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="size-4" />
        </button>
      </div>
      <div className="mt-1.5 text-center text-[10px] text-zinc-400">
        Responses may take a few seconds. Press Shift-Enter for a new line.
      </div>
    </div>
  )
}
