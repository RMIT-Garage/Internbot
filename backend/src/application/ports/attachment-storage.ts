export interface AttachmentStorage {
  createReadUrl(filePath: string, expiresAt: Date): Promise<string>
  deleteObject(filePath: string): Promise<void>
}
