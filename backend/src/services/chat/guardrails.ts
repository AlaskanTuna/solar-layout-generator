/**
 * Lightweight chat-input guardrails.
 *
 * Rejects oversized messages and common prompt-injection attempts before
 * user text reaches the solar assistant prompt builder.
 */

const PATTERNS = [
  // Blocks jailbreaks that ask the assistant to discard its configured instructions.
  /ignore\s+(?:(?:all|previous|above)\s+){1,2}(instructions|rules)/i,
  // Blocks role-reassignment prompts that try to replace the assistant persona.
  /you\s+are\s+now\s+(a|an)\s+/i,
  // Blocks attempts to force the model to impersonate a different AI system.
  /act\s+as\s+(a|an)\s+different\s+ai/i,
  // Blocks XML-style prompt injection that tries to introduce a system message.
  /<\s*system\s*>/i,
  // Blocks chat transcripts that spoof a high-priority system role.
  /^\s*system\s*:/i,
  // Allow "me/us" between verb and pronoun ("show me your prompt"), and accept
  // "tell" / "repeat" plus "instructions(s)" / "initial instructions" variants.
  // Blocks prompt-extraction attempts that ask for hidden instructions or prompts.
  /(reveal|show|print|tell|repeat)\s+(?:me\s+|us\s+)?(your|the)\s+(?:system\s+|initial\s+|original\s+)?(prompt|instructions?)/i
]

export type GuardResult = { ok: true } | { ok: false; reason: 'too_long' | 'injection_attempt' }

/**
 * Applies simple prompt-injection guardrails to user chat input.
 *
 * @param message - User chat message to inspect before prompt construction
 * @returns Guard result indicating acceptance or the rejection reason
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
