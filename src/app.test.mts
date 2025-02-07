import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import supertest from 'supertest'
import { app } from './app.mts'

const server = supertest(app)

describe('oauth2 process', () => {
  describe('GET /api/oauth/authorize', () => {
    const params = {
      response_type: 'code',
      client_id: process.env.CLIENT_ID,
      redirect_uri: process.env.REDIRECT_URI,
    }

    test('should throw on invalid query parameters', async () => {
      type ParamKey = keyof typeof params
      const errorBody: Record<ParamKey, unknown> = {
        response_type: {
          error: 'unsupported_response_type',
          error_description: 'response_type must be "code"',
        },
        client_id: {
          error: 'invalid_client',
          error_description: 'Unknown client_id',
        },
        redirect_uri: {
          error: 'invalid_request',
          error_description: 'redirect_uri mismatch',
        },
      }
      for (const omittedParam of Object.keys(params) as ParamKey[]) {
        const searchParams = new URLSearchParams(params)
        searchParams.delete(omittedParam)
        const response = await server.get(
          `/api/oauth/authorize?${searchParams}`
        )
        assert.equal(response.status, 400)
        assert.deepEqual(response.body, errorBody[omittedParam])
      }
    })

    test('should generate code', async () => {
      const searchParams = new URLSearchParams(params)
      const response = await server.get(`/api/oauth/authorize?${searchParams}`)
      assert.equal(response.status, 302)
      const redirectUrl = new URL(response.get('location') as string)
      assert.equal(
        `${redirectUrl.origin}${redirectUrl.pathname}`,
        process.env.REDIRECT_URI
      )
      assert.equal(typeof redirectUrl.searchParams.get('code'), 'string')
      assert.equal(redirectUrl.searchParams.has('state'), false)
    })

    test('should generate code with state', async () => {
      const state = crypto.randomUUID()
      const searchParams = new URLSearchParams({ ...params, state })
      const response = await server.get(`/api/oauth/authorize?${searchParams}`)
      assert.equal(response.status, 302)
      const redirectUrl = new URL(response.get('location') as string)
      assert.equal(
        `${redirectUrl.origin}${redirectUrl.pathname}`,
        process.env.REDIRECT_URI
      )
      assert.equal(typeof redirectUrl.searchParams.get('code'), 'string')
      assert.equal(redirectUrl.searchParams.get('state'), state)
    })
  })
})
