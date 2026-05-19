import { describe, expect, it } from 'vitest'
import { Attachment } from '../../../../src/domain/value-objects/attachment'

describe('Attachment', () => {
  it('creates immutable attachment metadata with an upload status', () => {
    const uploadedAt = new Date('2026-04-05T02:50:00Z')

    const attachment = Attachment.create({
      id: 'att_001',
      filePath: 'users/usr_001/internships/int_001/attachments/att_001-offer.pdf',
      fileName: 'offer.pdf',
      contentType: 'application/pdf',
      uploadedAt,
      storageGeneration: '1700000000000001',
      uploadStatus: 'finalized',
    })

    expect(attachment.id).toBe('att_001')
    expect(attachment.filePath).toBe(
      'users/usr_001/internships/int_001/attachments/att_001-offer.pdf'
    )
    expect(attachment.fileName).toBe('offer.pdf')
    expect(attachment.contentType).toBe('application/pdf')
    expect(attachment.uploadedAt).toBe(uploadedAt)
    expect(attachment.storageGeneration).toBe('1700000000000001')
    expect(attachment.uploadStatus).toBe('finalized')
    expect(attachment.isFinalized()).toBe(true)
  })

  it('treats uploading attachments as not-yet-finalized', () => {
    const attachment = Attachment.create({
      id: 'att_002',
      filePath: 'opportunities/opp_001/attachments/att_002-position.pdf',
      fileName: 'position.pdf',
      contentType: 'application/pdf',
      uploadedAt: new Date(),
      storageGeneration: undefined,
      uploadStatus: 'uploading',
    })

    expect(attachment.isFinalized()).toBe(false)
    expect(attachment.storageGeneration).toBeUndefined()
  })

  it('withFinalized returns a new VO and is a no-op once already finalized', () => {
    const uploading = Attachment.create({
      id: 'att_003',
      filePath: 'opportunities/opp_001/attachments/att_003-position.pdf',
      fileName: 'position.pdf',
      contentType: 'application/pdf',
      uploadedAt: new Date('2026-04-04T00:00:00Z'),
      storageGeneration: undefined,
      uploadStatus: 'uploading',
    })
    const finalizedAt = new Date('2026-04-05T00:00:00Z')

    const finalized = uploading.withFinalized('1700000000000099', finalizedAt)

    expect(finalized).not.toBe(uploading)
    expect(finalized.isFinalized()).toBe(true)
    expect(finalized.storageGeneration).toBe('1700000000000099')
    expect(finalized.uploadedAt).toBe(finalizedAt)
    expect(uploading.isFinalized()).toBe(false)

    const reFinalized = finalized.withFinalized('different', new Date())
    expect(reFinalized).toBe(finalized)
  })

  it('rejects empty ids and paths', () => {
    expect(() =>
      Attachment.create({
        id: '',
        filePath: 'opportunities/opp_001/attachments/att_x-position.pdf',
        fileName: 'position.pdf',
        contentType: 'application/pdf',
        uploadedAt: new Date(),
        storageGeneration: undefined,
        uploadStatus: 'uploading',
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_attachment' }))

    expect(() =>
      Attachment.create({
        id: 'att_001',
        filePath: '   ',
        fileName: 'position.pdf',
        contentType: 'application/pdf',
        uploadedAt: new Date(),
        storageGeneration: undefined,
        uploadStatus: 'uploading',
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_attachment' }))
  })
})
