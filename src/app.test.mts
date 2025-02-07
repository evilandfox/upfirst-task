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

  describe('POST /api/oauth/token', () => {
    test('should throw on invalid body parameters', async () => {
      const params = {
        client_id: process.env.CLIENT_ID,
        redirect_uri: process.env.REDIRECT_URI,
      }
      type ParamKey = keyof typeof params
      const errorBody: Record<ParamKey, unknown> = {
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
        const payload = new URLSearchParams({ ...params })
        payload.delete(omittedParam)
        const response = await server
          .post(`/api/oauth/token`)
          .send(payload.toString())
        assert.equal(response.status, 400)
        assert.deepEqual(response.body, errorBody[omittedParam])
      }
    })

    describe('authorization code', () => {
      test('should throw on invalid parameters', async () => {
        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.CLIENT_ID,
            redirect_uri: process.env.REDIRECT_URI,
          }).toString()
        )
        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_request',
          error_description: 'code is required',
        })
      })

      test('should throw on expired authorization code', async () => {
        const authResponse = await server.get(
          `/api/oauth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          })}`
        )
        const redirectUrl = new URL(authResponse.get('location') as string)
        const code = redirectUrl.searchParams.get('code')

        await delay(Number(process.env.ACCESS_TOKEN_EXPIRY) * 1000 + 1000)

        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        })
      })

      test('should throw on invalid authorization code', async () => {
        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: 'invalid_code',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        })
      })

      test('should successfully exchange code for tokens', async () => {
        const authParams = new URLSearchParams({
          response_type: 'code',
          client_id: process.env.CLIENT_ID!,
          redirect_uri: process.env.REDIRECT_URI!,
        })
        const authResponse = await server.get(
          `/api/oauth/authorize?${authParams}`
        )
        const redirectUrl = new URL(authResponse.get('location') as string)
        const code = redirectUrl.searchParams.get('code')

        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        assert.equal(response.status, 200)
        assert.equal(typeof response.body.access_token, 'string')
        assert.equal(typeof response.body.refresh_token, 'string')
        assert.equal(response.body.token_type, 'Bearer')
        assert.equal(typeof response.body.expires_in, 'number')
      })
    })

    describe('refresh token', () => {
      test('should throw on invalid parameters', async () => {
        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )
        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_request',
          error_description: 'refresh_token is required',
        })
      })

      test('should throw on expired refresh token', async () => {
        const authResponse = await server.get(
          `/api/oauth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          })}`
        )
        const redirectUrl = new URL(authResponse.get('location') as string)
        const code = redirectUrl.searchParams.get('code')

        const tokenResponse = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        await delay(Number(process.env.REFRESH_TOKEN_EXPIRY) * 1000 + 1000)

        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenResponse.body.refresh_token,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_grant',
          error_description: 'Refresh token expired',
        })
      })

      test('should throw on invalid refresh token', async () => {
        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: 'invalid_refresh_token',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        assert.equal(response.status, 400)
        assert.deepEqual(response.body, {
          error: 'invalid_grant',
          error_description: 'Invalid refresh token',
        })
      })

      test('should successfully refresh tokens', async () => {
        const authResponse = await server.get(
          `/api/oauth/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          })}`
        )
        const redirectUrl = new URL(authResponse.get('location') as string)
        const code = redirectUrl.searchParams.get('code')

        const tokenResponse = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'authorization_code',
            code: code!,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )

        await delay(1100)

        const response = await server.post('/api/oauth/token').send(
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenResponse.body.refresh_token,
            client_id: process.env.CLIENT_ID!,
            redirect_uri: process.env.REDIRECT_URI!,
          }).toString()
        )
        assert.equal(response.status, 200)
        assert.equal(typeof response.body.access_token, 'string')
        assert.equal(typeof response.body.refresh_token, 'string')
        assert.equal(response.body.token_type, 'Bearer')
        assert.equal(typeof response.body.expires_in, 'number')
        assert.notEqual(
          response.body.access_token,
          tokenResponse.body.access_token
        )
        assert.notEqual(
          response.body.refresh_token,
          tokenResponse.body.refresh_token
        )
      })
    })
  })
})

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
