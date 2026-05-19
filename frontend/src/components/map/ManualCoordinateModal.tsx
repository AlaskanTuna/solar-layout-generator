/**
 * Manual coordinate entry modal for map fallback flows.
 * Lets users submit latitude and longitude when address search cannot locate the Malaysian rooftop precisely.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'

type Bounds = { latMin: number; latMax: number; lngMin: number; lngMax: number }

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (lat: number, lng: number) => void
  bounds: Bounds
}

/**
 * Renders a lat/lng form with optional bounds validation for manual rooftop selection.
 * @param open - Whether the dialog is visible.
 * @param onClose - Called when the modal closes without a valid coordinate submit.
 * @param onSubmit - Receives parsed latitude and longitude once validation passes.
 * @param bounds - Allowed map bounds used to reject unsupported coordinates.
 */
export function ManualCoordinateModal({ open, onClose, onSubmit, bounds }: Props) {
  const { t } = useTranslation('map')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setLat('')
      setLng('')
      setError('')
    }
  }, [open])

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    if (Number.isNaN(latN) || Number.isNaN(lngN)) {
      setError(t('search.manualForm.errorInvalidCoords'))
      return
    }
    if (latN < bounds.latMin || latN > bounds.latMax || lngN < bounds.lngMin || lngN > bounds.lngMax) {
      setError(t('search.manualForm.errorOutOfBounds'))
      return
    }
    onSubmit(latN, lngN)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <DialogTitle>{t('search.manualModal.title')}</DialogTitle>
          <DialogDescription>{t('search.manualModal.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              inputMode="decimal"
              autoFocus
              placeholder={t('search.manualForm.latitudePlaceholder')}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="text"
              inputMode="decimal"
              placeholder={t('search.manualForm.longitudePlaceholder')}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-center text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-center pt-1">
            <Button type="submit" size="sm" className="min-w-[180px] gap-2">
              <MapPin className="h-3.5 w-3.5" />
              {t('search.manualForm.submitButton')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
