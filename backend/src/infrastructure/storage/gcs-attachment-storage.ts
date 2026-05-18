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

  async createUploadUrl(filePath: string, contentType: string, expiresAt: Date): Promise<string> {
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
      return emulatorUploadUrl(filePath)
    }

    const [url] = await adminStorage.bucket().file(filePath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType,
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

function emulatorUploadUrl(filePath: string): string {
  // Firebase Storage emulator accepts unauthenticated multipart uploads to
  // /v0/b/{bucket}/o?name={path}&uploadType=media. The signed-URL contract
  // here is "PUT body bytes" — the emulator doesn't support PUT to that path,
  // so we return the multipart URL and the client adapter (or test harness)
  // must POST. In real deployments this branch is skipped.
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? 'localhost:9199'
  const bucketName = adminStorage.bucket().name
  const encodedBucket = encodeURIComponent(bucketName)
  const encodedPath = encodeURIComponent(filePath)
  return `http://${host}/v0/b/${encodedBucket}/o?uploadType=media&name=${encodedPath}&bucket=${encodedBucket}`
}

export const gcsAttachmentStorage = new GcsAttachmentStorage()
