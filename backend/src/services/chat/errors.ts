export type ErrorCategory =
  | 'quota_exhausted'
  | 'service_unavailable'
  | 'permission_denied'
  | 'injection_rejected'
  | 'network_failure'
  | 'unknown'

type ChatLanguage = 'en' | 'ms' | 'zh'

/**
 * Pulls the HTTP-style status or string code off an unknown thrown value.
 * Shared across the chat orchestrator (auth-failure detection) and retry helper
 * (transient-vs-fatal classification).
 */
export function getErrorCode(error: unknown): number | string | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const maybeCode = error as { status?: number | string; code?: number | string }
  return maybeCode.status ?? maybeCode.code
}

/**
 * Maps a thrown chat error into a localized user-facing category and message.
 */
export function categoriseError(error: unknown, language: ChatLanguage): { category: ErrorCategory; message: string } {
  const redactedMessage = redactErrorMessage(error)
  const code = getErrorCode(error)

  const category: ErrorCategory =
    code === 429
      ? 'quota_exhausted'
      : code === 503
        ? 'service_unavailable'
        : code === 401 || code === 403
          ? 'permission_denied'
          : code === 'injection_rejected'
            ? 'injection_rejected'
            : /network|fetch|ENOTFOUND|ECONNREFUSED/i.test(redactedMessage)
              ? 'network_failure'
              : 'unknown'

  return {
    category,
    message: localiseErrorMessage(category, language)
  }
}

function redactErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error ?? '')
  }

  const redacted = error.message.replace(/\d{4,}/g, '[redacted]')
  error.message = redacted
  return redacted
}

function localiseErrorMessage(category: ErrorCategory, language: ChatLanguage): string {
  const messages: Record<ChatLanguage, Record<ErrorCategory, string>> = {
    en: {
      quota_exhausted: "We've hit our daily limit. Please try again in a few minutes.",
      service_unavailable: 'The assistant is temporarily unavailable. Please try again shortly.',
      permission_denied: 'The assistant is not configured correctly. Please contact support.',
      injection_rejected: "Sorry, I can't process that request. Try rephrasing your question.",
      network_failure: "Couldn't reach the assistant. Check your connection and try again.",
      unknown: 'Something went wrong. Please try again.'
    },
    ms: {
      quota_exhausted: 'Kami telah mencapai had harian. Cuba lagi dalam beberapa minit.',
      service_unavailable: 'Pembantu ini tidak tersedia buat sementara waktu. Cuba lagi sebentar lagi.',
      permission_denied: 'Pembantu ini tidak dikonfigurasi dengan betul. Sila hubungi sokongan.',
      injection_rejected: 'Maaf, saya tidak boleh memproses permintaan itu. Cuba tanya semula dengan cara lain.',
      network_failure: 'Tidak dapat menghubungi pembantu. Semak sambungan anda dan cuba lagi.',
      unknown: 'Sesuatu telah berlaku. Sila cuba lagi.'
    },
    zh: {
      quota_exhausted: '我们已达到每日限额，请几分钟后再试。',
      service_unavailable: '助手暂时不可用，请稍后再试。',
      permission_denied: '助手配置不正确，请联系支援人员。',
      injection_rejected: '抱歉，我不能处理这个请求。请换个说法再问一次。',
      network_failure: '无法连接到助手，请检查网络后再试。',
      unknown: '发生了一些问题，请再试一次。'
    }
  }

  return messages[language][category]
}
