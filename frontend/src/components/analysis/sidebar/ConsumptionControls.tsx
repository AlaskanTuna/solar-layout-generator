import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InfoTooltip } from '@/components/ui/InfoTooltip'
import { ImagePopup } from '@/components/ui/ImagePopup'
import tnbBillImg from '@/assets/tnb-bill-avg-kwh.png'
import { SEASONAL_MULTIPLIERS, type ConsumptionProfile } from '@/lib/analysis'
import type { AnalysisFormState } from '@/hooks/useAnalysisForm'

type ConsumptionControlsProps = {
  formState: AnalysisFormState
  setFormState: React.Dispatch<React.SetStateAction<AnalysisFormState | null>>
}

export function ConsumptionControls({ formState, setFormState }: ConsumptionControlsProps) {
  const { t } = useTranslation('analysis')
  const [billImageOpen, setBillImageOpen] = useState(false)
  const handleBillImageOpenChange = useCallback((open: boolean) => setBillImageOpen(open), [])

  return (
    <div data-tour="consumption-input" className="space-y-2 rounded-xl border border-border bg-card/90 p-4">
      <div className="space-y-1">
        <Label>
          {t('sidebar.consumption.label')}
          <InfoTooltip open={billImageOpen || undefined}>
            <div className="space-y-1.5">
              <p>{t('sidebar.consumption.tooltipText')}</p>
              <ImagePopup
                src={tnbBillImg}
                alt={t('sidebar.consumption.imageAlt')}
                className="w-full rounded"
                onOpenChange={handleBillImageOpenChange}
              />
              <p className="text-[10px]">{t('sidebar.consumption.imageHint')}</p>
            </div>
          </InfoTooltip>
        </Label>
        <p className="text-xs text-muted-foreground">{t('sidebar.consumption.subtext')}</p>
      </div>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder={t('sidebar.consumption.placeholder')}
        value={formState.monthlyConsumptionKwh === 0 ? '' : String(formState.monthlyConsumptionKwh)}
        onChange={(event) => {
          const raw = event.target.value.replace(/[^0-9]/g, '')
          setFormState((current) =>
            current ? { ...current, monthlyConsumptionKwh: raw === '' ? 0 : Number(raw) } : current
          )
        }}
      />
      <div className="mt-2 flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">{t('sidebar.consumption.profileLabel')}</Label>
        <div className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
          <button
            type="button"
            className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'flat' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setFormState((current) => (current ? { ...current, consumptionProfile: 'flat' as ConsumptionProfile } : current))}
          >
            {t('sidebar.consumption.profileFlat')}
          </button>
          <button
            type="button"
            className={`rounded px-2.5 py-1 font-medium transition-colors ${formState.consumptionProfile === 'seasonal' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setFormState((current) => (current ? { ...current, consumptionProfile: 'seasonal' as ConsumptionProfile } : current))}
          >
            {t('sidebar.consumption.profileSeasonal')}
          </button>
        </div>
        <InfoTooltip text={t('sidebar.consumption.profileTooltip')} />
      </div>
      {formState.consumptionProfile === 'seasonal' && (
        <p className="text-xs text-muted-foreground">
          {t('sidebar.consumption.seasonalRange', {
            min: Math.round(formState.monthlyConsumptionKwh * Math.min(...SEASONAL_MULTIPLIERS)),
            max: Math.round(formState.monthlyConsumptionKwh * Math.max(...SEASONAL_MULTIPLIERS))
          })}
        </p>
      )}
    </div>
  )
}
