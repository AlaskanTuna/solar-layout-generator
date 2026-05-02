import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const KNOWLEDGE_PATH = path.join(__dirname, 'knowledge.md')
const SECTION_RE = /^##\s+(.+)$/gm

let cachedSections: Map<string, string> | null = null

/**
 * Loads and caches the sectioned chat knowledge bible from disk.
 */
export function loadKnowledgeBible(): Map<string, string> {
  if (cachedSections) {
    return cachedSections
  }

  const raw = readFileSync(KNOWLEDGE_PATH, 'utf-8')
  cachedSections = parseSections(raw)
  console.info(`[Chat] Loaded knowledge bible: ${cachedSections.size} sections, ${raw.length} chars`)
  return cachedSections
}

/**
 * Renders the cached knowledge bible back into prompt-ready Markdown.
 */
export function renderKnowledgeForPrompt(): string {
  return [...loadKnowledgeBible().entries()].map(([title, body]) => `## ${title}\n${body.trim()}`).join('\n\n')
}

function parseSections(raw: string): Map<string, string> {
  const sections = new Map<string, string>()
  const matches = [...raw.matchAll(SECTION_RE)]

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index]
    const next = matches[index + 1]

    if (!current || current.index === undefined) {
      continue
    }

    const title = current[1]?.trim()
    if (!title) {
      continue
    }

    const start = current.index + current[0].length
    const end = next?.index ?? raw.length
    sections.set(title, raw.slice(start, end).trim())
  }

  return sections
}
