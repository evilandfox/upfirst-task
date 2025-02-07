import { jwtVerify, SignJWT } from 'jose'

export async function signToken(
  expiresIn: number,
  type: 'access' | 'refresh' | 'code',
  sub: string
) {
  return await new SignJWT({
    type,
    sub,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(jwtKey)
}

export async function verifyToken(token: string) {
  return await jwtVerify(token, jwtKey)
}

const jwtKey = new TextEncoder().encode(process.env.JWT_SECRET)
