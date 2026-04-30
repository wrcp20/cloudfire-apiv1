import { createTestDb, SCHEMA } from './helpers/d1-mock'
import type { Bindings } from '../types'

export const TEST_API_KEY = 'test-api-key-12345'

export function createTestEnv(): Bindings {
  return {
    DB: createTestDb(SCHEMA),
    API_KEY: TEST_API_KEY,
    ALLOWED_ORIGIN: '*',
  }
}
