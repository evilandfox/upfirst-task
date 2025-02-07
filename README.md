### Task

https://genes.notion.site/TypeScript-Knowledge-Assessment-Task-Implementing-an-OAuth-2-0-REST-API-1927341d06db80a680b5d6def853ddc2

### DESIGN CONSIDERATIONS

- Do minimal required work, which results in next decisions
- Use Node.js v22 with [TypeScript Type Stripping feature](<(https://nodejs.org/docs/latest/api/typescript.html#type-stripping)>) for development and testing
- Test using Node.js build-in module
- Use `jose` for working with JWT
- Use `dotenv-flow` for environment variables

### WARNINGS

- By the task authorize route don't make any authentication process (for example login via email/password). It doesn't make sense in real world
- There no protection against refresh token stealing
- Of course I can do better, refactor code, make it more safe etc, but I don't want to spend more time and the task doesn't require it

### HOW TO TEST

You firstly need to add `.env.test` file a least the following lines to be able to check token or code expiration

```env
AUTH_CODE_EXPIRY=3
ACCESS_TOKEN_EXPIRY=3
REFRESH_TOKEN_EXPIRY=3

```

