import { useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

const STORAGE_KEY = 'slg-analysis-card-order'

type CardItem = {
  id: string
  node: ReactNode
}

function loadOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveOrder(order: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1
  }

  return (
    <div ref={setNodeRef} style={style} className="group/sortable relative">
      {/* Drag handle — appears on hover */}
      <button
        type="button"
        className="absolute -left-2 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground opacity-0 shadow-sm transition-opacity hover:bg-foreground hover:text-background group-hover/sortable:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      {children}
    </div>
  )
}

export function SortableCardContainer({ cards }: { cards: CardItem[] }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const defaultOrder = useMemo(() => cards.map((c) => c.id), [cards])

  const [order, setOrder] = useState<string[]>(() => {
    const saved = loadOrder()
    if (!saved) return defaultOrder
    // Reconcile: keep only IDs that exist in cards, append any new ones
    const validIds = new Set(defaultOrder)
    const reconciled = saved.filter((id) => validIds.has(id))
    for (const id of defaultOrder) {
      if (!reconciled.includes(id)) reconciled.push(id)
    }
    return reconciled
  })

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string)
      const newIndex = prev.indexOf(over.id as string)
      const next = arrayMove(prev, oldIndex, newIndex)
      saveOrder(next)
      return next
    })
  }, [])

  // Build ordered card list based on current order
  const cardMap = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const orderedCards = useMemo(() => order.map((id) => cardMap.get(id)).filter(Boolean) as CardItem[], [order, cardMap])

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {orderedCards.map((card) => (
            <SortableCard key={card.id} id={card.id}>
              {card.node}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
