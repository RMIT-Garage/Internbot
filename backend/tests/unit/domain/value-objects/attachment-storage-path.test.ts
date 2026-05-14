import { describe, expect, it } from 'vitest'
import { parseAttachmentStoragePath } from '../../../../src/domain/value-objects/attachment-storage-path'

describe('parseAttachmentStoragePath', () => {
  it('parses opportunity attachment paths', () => {
    expect(parseAttachmentStoragePath('opportunities/opp_001/attachments/position.pdf')).toEqual({
      kind: 'opportunity',
      opportunityId: 'opp_001',
      fileName: 'position.pdf',
      filePath: 'opportunities/opp_001/attachments/position.pdf',
    })
  })

  it('parses internship attachment paths with the owning user id', () => {
    expect(
      parseAttachmentStoragePath('users/usr_001/internships/int_001/attachments/offer.pdf')
    ).toEqual({
      kind: 'internship',
      userId: 'usr_001',
      internshipId: 'int_001',
      fileName: 'offer.pdf',
      filePath: 'users/usr_001/internships/int_001/attachments/offer.pdf',
    })
  })

  it('rejects unsupported or nested attachment paths', () => {
    expect(parseAttachmentStoragePath('tickets/tkt_001/attachments/file.pdf')).toBeNull()
    expect(
      parseAttachmentStoragePath('users/usr_001/internships/int_001/attachments/nested/file.pdf')
    ).toBeNull()
  })
})
