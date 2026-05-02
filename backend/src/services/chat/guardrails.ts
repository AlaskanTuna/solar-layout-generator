const PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions|rules)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /act\s+as\s+(a|an)\s+different\s+ai/i,
  /<\s*system\s*>/i,
  /^\s*system\s*:/i,
  /(reveal|show|print)\s+(your|the)\s+(system\s+)?prompt/i
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
