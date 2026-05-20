/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Internship attachment metadata with a fresh short-lived Cloud Storage signed URL.
 */
export type InternshipAttachmentDownloadResponse = {
  id: string
  fileName: string | null
  contentType: string | null
  uploadedAt: string
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  uploadStatus: InternshipAttachmentDownloadResponse.uploadStatus
  downloadUrl: string
  downloadUrlExpiresAt: string
}
export namespace InternshipAttachmentDownloadResponse {
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  export enum uploadStatus {
    UPLOADING = 'uploading',
    FINALIZED = 'finalized',
  }
}
