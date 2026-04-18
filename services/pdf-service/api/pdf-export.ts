import chromium from '@sparticuz/chromium'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer, { type Browser } from 'puppeteer-core'
import { z } from 'zod'

const BodySchema = z.object({
  previewUrl: z.string().url(),
  filename: z.string().min(1).max(200).optional()
})

const NAV_TIMEOUT_MS = 30_000
const READY_TIMEOUT_MS = 30_000
// A4 landscape CSS viewport ~ 1123 x 794 px at 96 DPI. Add height headroom so multi-page content renders.
const VIEWPORT = { width: 1280, height: 1800, deviceScaleFactor: 2 }
const PAGE_MARGIN = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }

function setCorsHeaders(res: VercelResponse, allowedOrigin: string) {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowedOrigin = process.env.ALLOWED_FRONTEND_ORIGIN
  if (!allowedOrigin) {
    return res.status(500).json({ error: 'Server misconfigured: ALLOWED_FRONTEND_ORIGIN unset' })
  }

  setCorsHeaders(res, allowedOrigin)

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed', allowed: ['POST'] })
  }

  const parsed = BodySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
  }

  const { previewUrl, filename = 'solar-analysis.pdf' } = parsed.data

  let previewOrigin: string
  try {
    previewOrigin = new URL(previewUrl).origin
  } catch {
    return res.status(400).json({ error: 'previewUrl is not a valid URL' })
  }

  if (previewOrigin !== allowedOrigin) {
    return res.status(403).json({
      error: 'previewUrl origin not allowed',
      expected: allowedOrigin,
      got: previewOrigin
    })
  }

  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true
    })

    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.goto(previewUrl, { waitUntil: 'networkidle0', timeout: NAV_TIMEOUT_MS })
    await page.waitForFunction('window.__PDF_READY__ === true', { timeout: READY_TIMEOUT_MS })

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: PAGE_MARGIN,
      preferCSSPageSize: true
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).send(Buffer.from(pdf))
  } catch (err) {
    console.error('PDF export failed:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: 'PDF generation failed', message })
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (closeErr) {
        console.error('Failed to close browser:', closeErr)
      }
    }
  }
}
