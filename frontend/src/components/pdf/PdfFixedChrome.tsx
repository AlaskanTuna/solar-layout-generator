import { Leaf } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/ui/Logo'
import type { ImageryQuality } from '@shared/types'

type HeaderProps = {
  projectName: string
  generatedAt: string
}

export function PdfFixedHeader({ projectName, generatedAt }: HeaderProps) {
  const { t } = useTranslation('pdf')

  return (
    <header className="pdf-doc-header">
      <div className="flex items-center gap-2">
        <Logo className="h-6 w-6" />
        <div>
          <p className="text-[10px] font-bold leading-tight text-foreground">{t('header.reportTitle')}</p>
          <p className="text-[8px] leading-tight text-muted-foreground">
            {t('header.generatedAt', { projectName, date: generatedAt })}
          </p>
        </div>
      </div>
    </header>
  )
}

type FooterProps = {
  imageryQuality?: ImageryQuality | null
}

export function PdfFixedFooter({ imageryQuality }: FooterProps = {}) {
  const { t } = useTranslation('pdf')

  return (
    <footer className="pdf-doc-footer">
      <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
        <Leaf className="h-2 w-2 text-green-600 dark:text-green-400" />
        {t('footer.sdg')}
      </div>
      {imageryQuality === 'BASE' && (
        <>
          <div className="h-2 w-px bg-border" />
          <span className="text-[8px] font-medium text-amber-700 dark:text-amber-400">
            {t('footer.imageryBase')}
          </span>
        </>
      )}
      <div className="h-2 w-px bg-border" />
      <div className="flex items-center gap-1">
        <Logo className="h-3.5 w-3.5" />
        <span className="font-heading text-[8px] font-semibold tracking-tight">SolarSim</span>
        <span className="text-[8px] text-muted-foreground">{t('footer.year')}</span>
      </div>
    </footer>
  )
}
