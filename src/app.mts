import express from 'express'
import { authRouter } from './auth.mts'

export const app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.use('/api/oauth', authRouter)
