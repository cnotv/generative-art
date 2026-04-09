import { describe, it, expect, beforeEach } from 'vitest'
import { storageSaveLocal, storageLoadLocal, storageDeleteLocal, storageListLocal } from './storage'

describe('storage (localStorage)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('storageSaveLocal / storageLoadLocal', () => {
    it('should save and load a slot', () => {
      storageSaveLocal('test', 'data:image/png;base64,abc')
      const slot = storageLoadLocal('test')
      expect(slot).not.toBeNull()
      expect(slot!.name).toBe('test')
      expect(slot!.dataUrl).toBe('data:image/png;base64,abc')
    })

    it('should return null for missing slot', () => {
      expect(storageLoadLocal('nonexistent')).toBeNull()
    })

    it('should overwrite an existing slot', () => {
      storageSaveLocal('test', 'data:image/png;base64,v1')
      storageSaveLocal('test', 'data:image/png;base64,v2')
      expect(storageLoadLocal('test')!.dataUrl).toBe('data:image/png;base64,v2')
    })
  })

  describe('storageDeleteLocal', () => {
    it('should remove a slot', () => {
      storageSaveLocal('test', 'data:image/png;base64,abc')
      storageDeleteLocal('test')
      expect(storageLoadLocal('test')).toBeNull()
    })
  })

  describe('storageListLocal', () => {
    it('should list saved slot names sorted', () => {
      storageSaveLocal('beta', 'url1')
      storageSaveLocal('alpha', 'url2')
      storageSaveLocal('gamma', 'url3')
      expect(storageListLocal()).toEqual(['alpha', 'beta', 'gamma'])
    })

    it('should return empty array when no slots', () => {
      expect(storageListLocal()).toEqual([])
    })
  })
})
