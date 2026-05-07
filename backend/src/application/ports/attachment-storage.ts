export interface AttachmentStorage {
  createReadUrl(filePath: string, expiresAt: Date): Promise<string>
  /**
   * Hard-delete a Cloud Storage object. The request path does not call this
   * directly — soft-delete inverts that responsibility onto a future outbox
   * worker that will delete with `ifGenerationMatch` against the captured
   * `storageGeneration`. The trigger that absorbs invalid uploads still uses
   * this method, hence the unconditional signature.
   */
  deleteObject(filePath: string): Promise<void>
}
