import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  onAccept: () => void
  onCancel: () => void
}

/**
 * Renders the lowerresolutionconsent modal
 * @param {Props} props - Props for the component
 */
export function LowerResolutionConsentModal({ open, onAccept, onCancel }: Props) {
  const { t } = useTranslation('map')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{t('consentModal.title')}</DialogTitle>
          <DialogDescription>
            {t('consentModal.description')}
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>{t('consentModal.bullet1')}</li>
          <li>{t('consentModal.bullet2')}</li>
          <li>{t('consentModal.bullet3')}</li>
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="sm:min-w-[100px]">
            {t('consentModal.cancel')}
          </Button>
          <Button size="sm" onClick={onAccept} className="sm:min-w-[100px]">
            {t('consentModal.proceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
