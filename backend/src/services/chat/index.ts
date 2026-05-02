import { HarmBlockThreshold, HarmCategory, type Content, type GenerateContentResponse } from '@google/genai'
import type { Request, Response } from 'express'
import { env } from '../../config/env.js'
import { NotFoundError } from '../../errors.js'
import * as projectService from '../projectService.js'
import { buildSystemInstruction } from './prompt.js'
import { getGenAIClient, invalidateForAuthFailure } from './client.js'
import { categoriseError, type ErrorCategory } from './errors.js'
import { validateChatInput } from './guardrails.js'
import { generateWithRetry } from './retry.js'
import type { ChatRequest } from '../../validators/chat.js'

type ChatProject = NonNullable<Awaited<ReturnType<typeof projectService.getProject>>>
type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'done' }
  | { type: 'error'; category: ErrorCategory; message: string }

const PROCESSING_MESSAGE: Record<ChatRequest['language'], string> = {
  en: 'Your project is still being prepared. Please try again in a moment.',
  ms: 'Projek anda masih sedang disediakan. Sila cuba lagi sebentar lagi.',
  zh: '你的项目仍在准备中，请稍后再试。'
}

/**
 * Streams a grounded Gemini response over SSE for a single project chat turn.
 */
export async function streamChat(req: Request, res: Response): Promise<void> {
  const projectId = req.params.id as string
  const { message, history, language, page } = req.body as ChatRequest
  const userId = req.user!.id

  const project = await projectService.getProject(userId, projectId)
  if (!project) {
    console.warn(`[Chat] Project not found user=${userId} project=${projectId}`)
    throw new NotFoundError('Project not found')
  }

  if (project.location?.status === 'processing') {
    res.status(409).json({ error: PROCESSING_MESSAGE[language] })
    return
  }

  const guard = validateChatInput(message)
  if (!guard.ok) {
    setSseHeaders(res)
    res.flushHeaders()
    const { category, message: guardMessage } = categoriseError({ code: 'injection_rejected' }, language)
    writeSse(res, { type: 'error', category, message: guardMessage })
    res.end()
    return
  }

  setSseHeaders(res)
  res.flushHeaders()

  const systemInstruction = buildSystemInstruction(project, page, language)
  const contents = buildContents(history, message)

  async function callOnce(): Promise<AsyncGenerator<GenerateContentResponse>> {
    const client = getGenAIClient()
    return client.models.generateContentStream({
      model: env.CHAT_MODEL,
      contents,
      config: {
        systemInstruction,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE
          }
        ]
      }
    })
  }

  try {
    let stream: AsyncGenerator<GenerateContentResponse>

    try {
      stream = await generateWithRetry(callOnce)
    } catch (error) {
      const code = getErrorCode(error)
      if ((code === 401 || code === 403) && env.GEMINI_API_KEY) {
        console.warn('[Chat] First stream attempt hit auth failure, retrying with invalidated client cache')
        invalidateForAuthFailure()
        stream = await generateWithRetry(callOnce)
      } else {
        throw error
      }
    }

    for await (const chunk of stream) {
      const text = chunk.text ?? ''
      if (text) {
        writeSse(res, { type: 'token', text })
      }
    }

    writeSse(res, { type: 'done' })
  } catch (error) {
    console.error('[Chat] Stream failed', error)
    const { category, message: localisedMessage } = categoriseError(error, language)
    writeSse(res, { type: 'error', category, message: localisedMessage })
  } finally {
    res.end()
  }
}

/**
 * Applies standard SSE response headers for token streaming.
 */
export function setSseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
}

/**
 * Writes one SSE event payload to the response stream.
 */
export function writeSse(res: Response, payload: ChatEvent): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function buildContents(history: ChatRequest['history'], message: string): Content[] {
  return [
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.content }]
    })),
    {
      role: 'user',
      parts: [{ text: message }]
    }
  ]
}

function getErrorCode(error: unknown): number | string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const maybeCode = error as { status?: number | string; code?: number | string }
  return maybeCode.status ?? maybeCode.code
}
