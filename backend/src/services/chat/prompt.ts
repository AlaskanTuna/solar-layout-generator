import * as projectService from '../projectService.js'
import { renderProjectDigest } from './digest.js'
import { renderKnowledgeForPrompt } from './knowledge.js'

type ChatProject = NonNullable<Awaited<ReturnType<typeof projectService.getProject>>>
type ChatPage = 'workbench' | 'analysis'
type ChatLanguage = 'en' | 'ms' | 'zh'

const LANGUAGE_META: Record<
  ChatLanguage,
  {
    name: string
    glossary: Array<[string, string]>
  }
> = {
  en: {
    name: 'English',
    glossary: [
      ['NEM credit', 'NEM credit'],
      ['AFA', 'AFA'],
      ['kWp / kWh', 'kWp / kWh'],
      ['tariff tier', 'tariff tier'],
      ['payback', 'payback'],
      ['SST', 'SST']
    ]
  },
  ms: {
    name: 'Bahasa Melayu',
    glossary: [
      ['NEM credit', 'kredit NEM'],
      ['AFA', 'AFA'],
      ['kWp / kWh', 'kWp / kWh'],
      ['tariff tier', 'blok tarif'],
      ['payback', 'tempoh pulang modal'],
      ['SST', 'SST']
    ]
  },
  zh: {
    name: 'Simplified Chinese',
    glossary: [
      ['NEM credit', 'NEM 净电量积分'],
      ['AFA', 'AFA（自动燃料调整）'],
      ['kWp / kWh', 'kWp / kWh'],
      ['tariff tier', '电价档位'],
      ['payback', '回本年限'],
      ['SST', 'SST（销售与服务税）']
    ]
  }
}

/**
 * Builds the full system instruction for a chat request.
 */
export function buildSystemInstruction(project: ChatProject, page: ChatPage, language: ChatLanguage): string {
  const languageMeta = LANGUAGE_META[language]

  return [
    renderLanguageLayer(languageMeta),
    renderPersonaLayer(),
    renderRulesLayer(),
    renderSuggestionsLayer(languageMeta.name),
    ['[LAYER 4 — Malaysian-Solar Primer]', renderKnowledgeForPrompt()].join('\n'),
    ['[LAYER 5 — Project Digest]', renderProjectDigest(project, page)].join('\n')
  ].join('\n\n')
}

function renderLanguageLayer(languageMeta: (typeof LANGUAGE_META)[ChatLanguage]): string {
  const glossaryRows = languageMeta.glossary.map(([term, rendering]) => `| ${term} | ${rendering} |`).join('\n')

  return [
    '[LAYER 0 — Language Lock]',
    `Respond ONLY in ${languageMeta.name}. Even if the user writes in another language, respond in ${languageMeta.name}. Use these consistent renderings for technical terms in ${languageMeta.name}:`,
    '| Term | Use |',
    '| --- | --- |',
    glossaryRows
  ].join('\n')
}

function renderPersonaLayer(): string {
  return [
    '[LAYER 1 — Persona]',
    'You are Sol, the warm and encouraging solar guide built into the SolarSim app. You help a Malaysian homeowner understand THIS solar project in plain, uplifting language — celebrate the good numbers, gently explain the tricky ones, and never sound like a textbook. Keep every response to 180 words or fewer. Assume the reader has no solar background and may be reading on their phone after a long day. When you refer to yourself, you are "Sol" (never "SolarSim Assistant" or "the assistant").'
  ].join('\n')
}

function renderRulesLayer(): string {
  return [
    '[LAYER 2 — Hard Rules]',
    "1. SCOPE — Only answer about (a) this project's data, (b) Malaysian rooftop solar (NEM 3.0, tariffs, AFA, payback, panels), or (c) how to use the SolarSim app. Off-topic means a polite one-sentence refusal.",
    `2. NO PROMISES — Frame financials as "this project's analysis estimates X under the listed assumptions", never "you will save X".`,
    '3. NO PII — Never ask for full IC, phone, address, or bank account details.',
    '4. NO LICENSED-PROFESSIONAL ADVICE — For wiring, certification, LSS or SEDA filings, redirect the user to a licensed solar installer.',
    `5. CITE OWN NUMBERS — When answering financial questions, cite the exact numbers from the project digest verbatim (for example: "your project's analysis estimates RM 142/month in savings").`
  ].join('\n')
}

function renderSuggestionsLayer(languageName: string): string {
  return [
    '[LAYER 3 — Suggestions Protocol]',
    'After your response, append on a NEW LINE exactly:',
    '<<<SUGGESTIONS>>>',
    '["question 1", "question 2", "question 3"]',
    `Write 2 or 3 short follow-up questions in ${languageName}, each 60 characters or fewer, that the user might naturally ask next given your answer and the project context.`,
    'Never include this marker mid-response. If you cannot produce suggestions, omit the marker and the JSON entirely.'
  ].join('\n')
}
