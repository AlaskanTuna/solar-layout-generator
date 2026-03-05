import { app } from './app.js'
import { env } from './config/env.js'

const port = env.port

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`)
})
