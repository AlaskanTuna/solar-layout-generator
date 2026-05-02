const PATTERNS = [
  /ignore\s+(?:(?:all|previous|above)\s+){1,2}(instructions|rules)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+(a|an)\s+different\s+ai/i,
  /<\s*system\s*>/i,
  /^\s*system\s*:/i,
  // Allow "me/us" between verb and pronoun ("show me your prompt"), and accept
  // "tell" / "repeat" plus "instructions(s)" / "initial instructions" variants.
  /(reveal|show|print|tell|repeat)\s+(?:me\s+|us\s+)?(your|the)\s+(?:system\s+|initial\s+|original\s+)?(prompt|instructions?)/i
]

export type GuardResult = { ok: true } | { ok: false; reason: 'too_long' | 'injection_attempt' }

/**
 * Applies simple prompt-injection guardrails to user chat input.
 */
export function validateChatInput(message: string): GuardResult {
  if (message.length > 4000) {
    return { ok: false, reason: 'too_long' }
  }

  for (const pattern of PATTERNS) {
    if (pattern.test(message)) {
      return { ok: false, reason: 'injection_attempt' }
    }
  }

  return { ok: true }
}
