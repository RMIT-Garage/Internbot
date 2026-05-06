import { describe, expect, it } from 'vitest'
import { Attachment } from '../../../../src/domain/value-objects/attachment'

describe('Attachment', () => {
  it('creates immutable attachment metadata', () => {
    const uploadedAt = new Date('2026-04-05T02:50:00Z')

    const attachment = Attachment.create({
      id: 'att_001',
      filePath: 'users/usr_001/internships/int_001/attachments/offer.pdf',
      fileName: 'offer.pdf',
      contentType: 'application/pdf',
      uploadedAt,
    })

    expect(attachment.id).toBe('att_001')
    expect(attachment.filePath).toBe('users/usr_001/internships/int_001/attachments/offer.pdf')
    expect(attachment.fileName).toBe('offer.pdf')
    expect(attachment.contentType).toBe('application/pdf')
    expect(attachment.uploadedAt).toBe(uploadedAt)
  })

  it('rejects empty ids and paths', () => {
    expect(() =>
      Attachment.create({
        id: '',
        filePath: 'opportunities/opp_001/attachments/position.pdf',
        fileName: 'position.pdf',
        contentType: 'application/pdf',
        uploadedAt: new Date(),
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_attachment' }))

    expect(() =>
      Attachment.create({
        id: 'att_001',
        filePath: '   ',
        fileName: 'position.pdf',
        contentType: 'application/pdf',
        uploadedAt: new Date(),
      })
    ).toThrow(expect.objectContaining({ reason: 'invalid_attachment' }))
  })
})
