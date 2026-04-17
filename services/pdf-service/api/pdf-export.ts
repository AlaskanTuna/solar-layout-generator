import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Scaffold-only handler. Task 3 replaces this with the Puppeteer implementation.
 * Keep the shape (POST, JSON body with previewUrl) stable so the frontend contract
 * can be developed in parallel.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST'] })
  }

  return res.status(501).json({
    error: 'Not Implemented',
    service: 'pdf-export',
    version: '0.1.0',
    message: 'Scaffolding only — Puppeteer implementation lands in Phase 9 Task 3.'
  })
}
