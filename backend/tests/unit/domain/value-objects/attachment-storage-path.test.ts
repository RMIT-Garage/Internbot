import { describe, expect, it } from 'vitest'
import { parseAttachmentStoragePath } from '../../../../src/domain/value-objects/attachment-storage-path'

describe('parseAttachmentStoragePath', () => {
  it('parses an opportunity attachment path with attachmentId prefix', () => {
    expect(
      parseAttachmentStoragePath('opportunities/opp_001/attachments/att_abc123-position.pdf')
    ).toEqual({
      kind: 'opportunity',
      opportunityId: 'opp_001',
      attachmentId: 'att_abc123',
      filePath: 'opportunities/opp_001/attachments/att_abc123-position.pdf',
    })
  })

  it('parses an internship attachment path with attachmentId prefix', () => {
    expect(
      parseAttachmentStoragePath(
        'users/usr_001/internships/int_001/attachments/att_xyz789-offer.pdf'
      )
    ).toEqual({
      kind: 'internship',
      userId: 'usr_001',
      internshipId: 'int_001',
      attachmentId: 'att_xyz789',
      filePath: 'users/usr_001/internships/int_001/attachments/att_xyz789-offer.pdf',
    })
  })

  it('rejects paths without an att_ prefix in the leaf filename', () => {
    expect(parseAttachmentStoragePath('opportunities/opp_001/attachments/position.pdf')).toBeNull()
    expect(
      parseAttachmentStoragePath('users/usr_001/internships/int_001/attachments/offer.pdf')
    ).toBeNull()
  })

  it('rejects unrelated path prefixes and nested leaves', () => {
    expect(parseAttachmentStoragePath('tickets/tkt_001/attachments/att_abc-file.pdf')).toBeNull()
    expect(
      parseAttachmentStoragePath(
        'users/usr_001/internships/int_001/attachments/nested/att_abc-file.pdf'
      )
    ).toBeNull()
  })
})
