import { app } from './app.mts'

app.listen(process.env.PORT, () => {
  console.log('App running at http://localhost:%s', process.env.PORT)
})
