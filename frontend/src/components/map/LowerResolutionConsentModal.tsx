import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  onAccept: () => void
  onCancel: () => void
}

export function LowerResolutionConsentModal({ open, onAccept, onCancel }: Props) {
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
          <DialogTitle>Lower-Resolution Imagery</DialogTitle>
          <DialogDescription>
            High-quality satellite data is not available for this address. We can proceed with BASE-tier imagery and
            expanded coverage instead, but accuracy will be lower.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Suggested panel positions may need more manual adjustment.</li>
          <li>Flux and irradiance estimates are at a coarser resolution.</li>
          <li>Coverage may extend slightly beyond the building outline.</li>
        </ul>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="sm:min-w-[100px]">
            Cancel
          </Button>
          <Button size="sm" onClick={onAccept} className="sm:min-w-[100px]">
            Proceed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
