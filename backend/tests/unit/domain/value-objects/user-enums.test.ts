import { describe, it, expect } from 'vitest'
import {
  onboardingStageValues,
  profileStatusValues,
  programLevelValues,
  programStatusValues,
  roleValues,
  studyLoadValues,
  userStatusValues,
} from '../../../../src/domain/value-objects/user-enums'

describe('user enum value sets', () => {
  it('roleValues is exactly ["student", "coordinator"]', () => {
    expect([...roleValues]).toEqual(['student', 'coordinator'])
  })

  it('profileStatusValues is ["incomplete", "complete"]', () => {
    expect([...profileStatusValues]).toEqual(['incomplete', 'complete'])
  })

  it('onboardingStageValues is ["profile_pending", "profile_complete"]', () => {
    expect([...onboardingStageValues]).toEqual(['profile_pending', 'profile_complete'])
  })

  it('userStatusValues is ["active", "inactive", "blocked"]', () => {
    expect([...userStatusValues]).toEqual(['active', 'inactive', 'blocked'])
  })

  it('programLevelValues is ["undergraduate", "postgraduate"]', () => {
    expect([...programLevelValues]).toEqual(['undergraduate', 'postgraduate'])
  })

  it('programStatusValues covers active/completed/discontinued', () => {
    expect([...programStatusValues]).toEqual(['active_in_program', 'completed', 'discontinued'])
  })

  it('studyLoadValues covers full/part/unknown', () => {
    expect([...studyLoadValues]).toEqual(['full_time', 'part_time', 'unknown'])
  })
})
