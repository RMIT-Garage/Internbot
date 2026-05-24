/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/opportunities/:id/attachments/upload-intents. Returns a signed PUT URL the coordinator uploads the file bytes to directly.
 */
export type CreateOpportunityAttachmentUploadIntentRequest = {
  fileName: string
  contentType: CreateOpportunityAttachmentUploadIntentRequest.contentType
}
export namespace CreateOpportunityAttachmentUploadIntentRequest {
  export enum contentType {
    APPLICATION_PDF = 'application/pdf',
    IMAGE_PNG = 'image/png',
    IMAGE_JPEG = 'image/jpeg',
    APPLICATION_MSWORD = 'application/msword',
    APPLICATION_VND_OPENXMLFORMATS_OFFICEDOCUMENT_WORDPROCESSINGML_DOCUMENT = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
}
