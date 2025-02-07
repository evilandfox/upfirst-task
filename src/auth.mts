import { Router } from 'express'
import { JWTExpired } from 'jose/errors'
import { signToken, verifyToken } from './jwt.mts'

export const authRouter = Router()

authRouter.get('/authorize', async (req, res) => {
  const { response_type, client_id, redirect_uri, state } = req.query
  if (response_type !== 'code') {
    return res.status(400).json({
      error: 'unsupported_response_type',
      error_description: 'response_type must be "code"',
    })
  }
  if (client_id !== process.env.CLIENT_ID) {
    return res
      .status(400)
      .json({ error: 'invalid_client', error_description: 'Unknown client_id' })
  }
  if (redirect_uri !== process.env.REDIRECT_URI) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'redirect_uri mismatch',
    })
  }

  // We somehow authorized user and got his ID (or it can be something like session)
  const sub = crypto.randomUUID()

  const code = await signToken(
    Number(process.env.AUTH_CODE_EXPIRY),
    'code',
    sub
  )

  const url = new URL(process.env.REDIRECT_URI)
  url.searchParams.append('code', code)
  if (state) {
    url.searchParams.append('state', state as string)
  }
  return res.redirect(url.toString())
})

authRouter.post('/token', async (req, res) => {
  const { grant_type, code, refresh_token, client_id, redirect_uri } = req.body
  if (client_id !== process.env.CLIENT_ID) {
    return res
      .status(400)
      .json({ error: 'invalid_client', error_description: 'Unknown client_id' })
  }
  if (redirect_uri !== process.env.REDIRECT_URI) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'redirect_uri mismatch',
    })
  }

  const respondWithTokens = async (sub: string) => {
    const accessToken = await signToken(
      Number(process.env.ACCESS_TOKEN_EXPIRY),
      'access',
      sub
    )
    const refreshToken = await signToken(
      Number(process.env.REFRESH_TOKEN_EXPIRY),
      'refresh',
      sub
    )
    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: Number(process.env.ACCESS_TOKEN_EXPIRY),
      refresh_token: refreshToken,
    })
  }

  if (grant_type === 'authorization_code') {
    if (!code) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'code is required',
      })
    }
    try {
      const token = await verifyToken(code)
      if (token.payload.type !== 'code' || !token.payload.sub) {
        throw new Error('Invalid token')
      }
      return await respondWithTokens(token.payload.sub)
    } catch (error) {
      if (error && error instanceof JWTExpired) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        })
      }
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code',
      })
    }
  }

  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'refresh_token is required',
      })
    }
    try {
      const token = await verifyToken(refresh_token)
      if (token.payload.type !== 'refresh' || !token.payload.sub) {
        throw new Error('Invalid token type')
      }
      return await respondWithTokens(token.payload.sub)
    } catch (error) {
      if (error && error instanceof JWTExpired) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Refresh token expired',
        })
      }
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid refresh token',
      })
    }
  }

  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: 'Grant type is not supported',
  })
})
