/**
 * Backend HTTP server entrypoint.
 *
 * Imports the configured Express app and binds it to the validated runtime
 * port on all interfaces for local and container deployments.
 */

import { app } from './app.js'
import { env } from './config/env.js'

const port = env.port

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${port}`)
})
