import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type ImagePopupProps = {
  src: string
  alt: string
  className?: string
  onOpenChange?: (open: boolean) => void
}

export function ImagePopup({ src, alt, className, onOpenChange }: ImagePopupProps) {
  const [open, setOpen] = useState(false)

  function handleOpen() {
    setOpen(true)
    onOpenChange?.(true)
  }

  function handleClose() {
    setOpen(false)
    onOpenChange?.(false)
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`cursor-pointer transition-opacity hover:opacity-80 ${className ?? ''}`}
        onClick={(e) => {
          e.stopPropagation()
          handleOpen()
        }}
      />
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60" onClick={handleClose}>
            <div className="relative max-h-[80vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="absolute -right-3 -top-3 rounded-full bg-card p-1.5 shadow-md hover:bg-muted"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </button>
              <img src={src} alt={alt} className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-2xl" />
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
