/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Attachment metadata for an opportunity position-description file.
 */
export type OpportunityAttachmentResponse = {
  id: string
  fileName: string | null
  contentType: string | null
  uploadedAt: string
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  uploadStatus: OpportunityAttachmentResponse.uploadStatus
}
export namespace OpportunityAttachmentResponse {
  /**
   * Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.
   */
  export enum uploadStatus {
    UPLOADING = 'uploading',
    FINALIZED = 'finalized',
  }
}
