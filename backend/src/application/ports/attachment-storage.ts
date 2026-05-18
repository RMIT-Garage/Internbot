export interface AttachmentStorage {
  createReadUrl(filePath: string, expiresAt: Date): Promise<string>
  /**
   * Mint a V4 signed PUT URL the client can upload directly to. The signed URL
   * IS the authorization for the upload — Cloud Storage rules are not consulted
   * because the backend has already run domain authz before minting. The
   * `contentType` is pinned into the signature: the client MUST send a matching
   * `Content-Type` header on the PUT or GCS will reject the request.
   */
  createUploadUrl(filePath: string, contentType: string, expiresAt: Date): Promise<string>
  /**
   * Hard-delete a Cloud Storage object. The request path does not call this
   * directly — soft-delete inverts that responsibility onto a future outbox
   * worker that will delete with `ifGenerationMatch` against the captured
   * `storageGeneration`. The trigger that absorbs invalid uploads still uses
   * this method, hence the unconditional signature.
   */
  deleteObject(filePath: string): Promise<void>
}
