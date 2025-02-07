declare namespace NodeJS {
  interface ProcessEnv {
    PORT: string

    CLIENT_ID: string
    REDIRECT_URI: string

    JWT_SECRET: string
    ACCESS_TOKEN_EXPIRY: string
    REFRESH_TOKEN_EXPIRY: string
    AUTH_CODE_EXPIRY: string
  }
}
