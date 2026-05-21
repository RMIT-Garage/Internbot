/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * V4 signed PUT URL the student-owner can upload an offer document to. The URL is bound to the supplied `contentType` — the client MUST send a matching `Content-Type` header on the PUT.
 */
export type InternshipAttachmentUploadIntentResponse = {
  attachmentId: string
  filePath: string
  uploadUrl: string
  uploadExpiresAt: string
  contentType: string
}
