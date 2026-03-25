import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function ImagePopup({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <img
        src={src}
        alt={alt}
        className={`cursor-pointer transition-opacity hover:opacity-80 ${className ?? ''}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      />
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
            onClick={() => setOpen(false)}
          >
            <div className="relative max-h-[80vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="absolute -right-3 -top-3 rounded-full bg-white p-1.5 shadow-md hover:bg-stone-100"
                onClick={() => setOpen(false)}
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
