import { Router } from 'express'

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

  const code = crypto.randomUUID()
  const expiresAt = Date.now() + Number(process.env.AUTH_CODE_EXPIRY) * 1000
  authCodes.set(code, {
    expiresAt,
    state: state as string | undefined,
  })

  const url = new URL(process.env.REDIRECT_URI)
  url.searchParams.append('code', code)
  if (state) {
    url.searchParams.append('state', state as string)
  }
  return res.redirect(url.toString())
})

const authCodes = new Map<string, { expiresAt: number; state?: string }>()
