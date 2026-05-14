import { randomUUID } from 'node:crypto'
import type { AttachmentStorage } from '../../application/ports/attachment-storage'
import { adminStorage } from '../config/firebase-admin'

export class GcsAttachmentStorage implements AttachmentStorage {
  async createReadUrl(filePath: string, expiresAt: Date): Promise<string> {
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      return emulatorDownloadUrl(filePath, expiresAt)
    }

    const [url] = await adminStorage.bucket().file(filePath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    })
    return url
  }

  async deleteObject(filePath: string): Promise<void> {
    await adminStorage.bucket().file(filePath).delete({ ignoreNotFound: true })
  }
}

function emulatorDownloadUrl(filePath: string, expiresAt: Date): string {
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? 'localhost:9199'
  const bucketName = adminStorage.bucket().name
  const encodedBucket = encodeURIComponent(bucketName)
  const encodedPath = encodeURIComponent(filePath)
  return `http://${host}/v0/b/${encodedBucket}/o/${encodedPath}?alt=media&expires=${expiresAt.getTime()}&nonce=${randomUUID()}`
}

export const gcsAttachmentStorage = new GcsAttachmentStorage()
