/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Attachment metadata for an internship offer document.
 */
export type InternshipAttachmentResponse = {
  id: string
  fileName: string | null
  contentType: string | null
  uploadedAt: string
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  uploadStatus: InternshipAttachmentResponse.uploadStatus
}
export namespace InternshipAttachmentResponse {
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  export enum uploadStatus {
    UPLOADING = 'uploading',
    FINALIZED = 'finalized',
  }
}
