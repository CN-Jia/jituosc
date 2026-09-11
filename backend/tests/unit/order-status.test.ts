import { describe, it, expect } from 'vitest'
import { isValidTransition } from '../../src/utils/order-status.js'

describe('order-status state machine', () => {
  it('CREATED can transition to PENDING or CANCELLED', () => {
    expect(isValidTransition('CREATED', 'PENDING')).toBe(true)
    expect(isValidTransition('CREATED', 'CANCELLED')).toBe(true)
  })

  it('PENDING can transition to IN_PROGRESS or CANCELLED', () => {
    expect(isValidTransition('PENDING', 'IN_PROGRESS')).toBe(true)
    expect(isValidTransition('PENDING', 'CANCELLED')).toBe(true)
  })

  it('IN_PROGRESS can transition to COMPLETED or CANCELLED', () => {
    expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true)
    expect(isValidTransition('IN_PROGRESS', 'CANCELLED')).toBe(true)
  })

  it('ACCEPTED (legacy) can transition to IN_PROGRESS or CANCELLED', () => {
    expect(isValidTransition('ACCEPTED', 'IN_PROGRESS')).toBe(true)
    expect(isValidTransition('ACCEPTED', 'CANCELLED')).toBe(true)
  })

  it('COMPLETED is terminal (no outgoing transitions)', () => {
    expect(isValidTransition('COMPLETED', 'PENDING')).toBe(false)
    expect(isValidTransition('COMPLETED', 'IN_PROGRESS')).toBe(false)
    expect(isValidTransition('COMPLETED', 'CLOSED')).toBe(false)
  })

  it('CANCELLED and CLOSED are terminal', () => {
    expect(isValidTransition('CANCELLED', 'PENDING')).toBe(false)
    expect(isValidTransition('CLOSED', 'PENDING')).toBe(false)
    expect(isValidTransition('CLOSED', 'IN_PROGRESS')).toBe(false)
  })
})
