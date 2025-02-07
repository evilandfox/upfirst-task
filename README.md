### Task

https://genes.notion.site/TypeScript-Knowledge-Assessment-Task-Implementing-an-OAuth-2-0-REST-API-1927341d06db80a680b5d6def853ddc2

### DESIGN CONSIDERATIONS

- Do minimal required work, which results in next decisions
- Use Node.js v22 with [TypeScript Type Stripping feature](<(https://nodejs.org/docs/latest/api/typescript.html#type-stripping)>) for development and testing
- Test using Node.js build-in module
- Use `jose` for working with JWT
- Use `dotenv-flow` for environment variables

### WARNINGS

- By the task authorize route don't make any authentication process (for example via email/password). It doesn't make sense in real world
- There no protection against refresh token stealing
- Start script invokes node which invokes typescript code. In production environment we better to bundle output code
