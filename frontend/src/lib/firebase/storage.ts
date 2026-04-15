import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type UploadTask,
} from 'firebase/storage'
import { storage } from './client'

export interface UploadProgress {
  bytesTransferred: number
  totalBytes: number
  percentage: number
}

export function uploadFile(
  path: string,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): { task: UploadTask; promise: Promise<string> } {
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file)

  const promise = new Promise<string>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes: snapshot.totalBytes,
            percentage: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          })
        }
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        resolve(url)
      }
    )
  })

  return { task, promise }
}

export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}

export function getUserAvatarPath(uid: string, filename: string): string {
  return `users/${uid}/avatar/${filename}`
}
