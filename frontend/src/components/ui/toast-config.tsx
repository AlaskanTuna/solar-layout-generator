import toast from 'react-hot-toast'
import type { ToastOptions } from 'react-hot-toast'
import { CheckCircle, XCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'

const BASE_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '12px 16px',
  fontSize: '0.875rem',
  boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
  maxWidth: '420px'
}

const baseOptions: ToastOptions = {
  duration: 2500,
  style: BASE_STYLE,
  position: 'bottom-center'
}

export const notify = {
  success: (message: string) =>
    toast.success(message, {
      ...baseOptions,
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      style: { ...BASE_STYLE, borderColor: 'rgba(34, 197, 94, 0.3)' }
    }),

  error: (message: string) =>
    toast.error(message, {
      ...baseOptions,
      duration: 4000,
      icon: <XCircle className="h-5 w-5 text-red-500" />,
      style: { ...BASE_STYLE, borderColor: 'rgba(239, 68, 68, 0.3)' }
    }),

  warning: (message: string) =>
    toast(message, {
      ...baseOptions,
      icon: <AlertTriangle className="h-5 w-5 text-amber-500" />,
      style: { ...BASE_STYLE, borderColor: 'rgba(245, 158, 11, 0.3)' }
    }),

  info: (message: string) =>
    toast(message, {
      ...baseOptions,
      icon: <Info className="h-5 w-5 text-primary" />,
      style: { ...BASE_STYLE, borderColor: 'rgba(249, 115, 22, 0.2)' }
    }),

  loading: (message: string) =>
    toast.loading(message, {
      ...baseOptions,
      icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
      duration: Infinity
    }),

  dismiss: toast.dismiss
}
