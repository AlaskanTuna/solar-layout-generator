import { lazy, Suspense, useState } from 'react'
import { Drawer } from 'vaul'
import type { PanelModel } from '@shared/types'
import { PANEL_MODELS } from '@shared/types'
import { cn } from '@/lib/utils'

const PanelPreview3D = lazy(() => import('./PanelPreview3D'))

const MODEL_CELL_COLORS: Record<string, string> = {
  'google-default': '#1a2744',
  'jinko-tiger-neo': '#0d1f3c',
  'longi-himo6': '#162d50',
  'ja-deepblue4': '#0a1a38',
  'canadian-hihero': '#1e2d4a',
  'trina-vertex-s': '#142642'
}

type PanelModelDrawerProps = {
  selectedModelId: string
  onSelect: (modelId: string) => void
  disabled?: boolean
}

export function PanelModelDrawer({ selectedModelId, onSelect, disabled = false }: PanelModelDrawerProps) {
  const [open, setOpen] = useState(false)
  const selectedModel = PANEL_MODELS.find((m) => m.id === selectedModelId) ?? PANEL_MODELS[1]!

  function handleSelect(modelId: string) {
    onSelect(modelId)
    setOpen(false)
  }

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild disabled={disabled}>
        <button
          className={cn(
            'flex items-center gap-2 rounded-t-xl border border-b-0 border-stone-300 bg-white px-5 py-2 text-sm shadow-md transition-all hover:bg-stone-50 active:scale-95',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-stone-400"
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
          <span className="text-xs font-semibold text-stone-700">Panels</span>
          <span className="text-[10px] text-stone-400">·</span>
          <span className="text-[10px] text-stone-500">{selectedModel.name}</span>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-2xl bg-white">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-stone-300" />
          <Drawer.Title className="px-6 pt-4 pb-2 text-lg font-semibold text-stone-900">
            Choose a Solar Panel
          </Drawer.Title>
          <Drawer.Description className="px-6 pb-4 text-sm text-stone-500">
            Select a panel model. This changes the size and energy output of all panels on your roof.
          </Drawer.Description>
          <div className="flex gap-4 overflow-x-auto px-6 pb-8 pt-2">
            {PANEL_MODELS.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                isSelected={model.id === selectedModelId}
                onSelect={() => handleSelect(model.id)}
              />
            ))}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function ModelCard({ model, isSelected, onSelect }: { model: PanelModel; isSelected: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'group flex min-w-[180px] flex-col rounded-xl border-2 bg-white p-3 text-left shadow-sm transition-all hover:shadow-md',
        isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-stone-200 hover:border-stone-300'
      )}
    >
      {/* 3D Preview */}
      <div className="mb-3 h-[120px] w-full overflow-hidden rounded-lg bg-gradient-to-b from-slate-100 to-slate-200">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <div className="h-16 w-10 rounded bg-blue-900/30" />
            </div>
          }
        >
          <PanelPreview3D widthM={model.widthM} heightM={model.heightM} cellColor={MODEL_CELL_COLORS[model.id]} />
        </Suspense>
      </div>

      {/* Model info */}
      <p className="text-sm font-semibold text-stone-900">{model.name}</p>
      <p className="text-xs text-stone-500">{model.manufacturer}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-600">
        <span>{model.capacityWp} Wp</span>
        <span>{(model.efficiency * 100).toFixed(1)}% eff.</span>
        <span>
          {model.heightM} x {model.widthM} m
        </span>
        {model.costPerWp > 0 && <span>RM {model.costPerWp.toFixed(2)}/Wp</span>}
      </div>
      {isSelected && (
        <div className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Selected
        </div>
      )}
    </button>
  )
}
