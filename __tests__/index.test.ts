import {execaNode} from 'execa'
import {describe, test} from 'vitest'

describe('build output', () => {
  test.skip('bundle runs correctly', async () => {
    // TODO: mock all endpoints for these tests
    await execaNode('./dist/index.js')
  })
})
