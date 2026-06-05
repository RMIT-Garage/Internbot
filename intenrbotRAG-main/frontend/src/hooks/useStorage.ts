'use client'

import { useState } from 'react'
import { uploadFile, type UploadProgress } from '@/lib/firebase/storage'

interface UseStorageUploadResult {
  upload: (path: string, file: File) => Promise<string>
  progress: UploadProgress | null
  uploading: boolean
  error: Error | null
}

export function useStorageUpload(): UseStorageUploadResult {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const upload = async (path: string, file: File): Promise<string> => {
    setUploading(true)
    setError(null)
    setProgress(null)

    try {
      const { promise } = uploadFile(path, file, setProgress)
      const url = await promise
      return url
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Upload failed')
      setError(e)
      throw e
    } finally {
      setUploading(false)
    }
  }

  return { upload, progress, uploading, error }
}
