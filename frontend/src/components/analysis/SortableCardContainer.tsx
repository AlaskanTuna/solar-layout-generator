import { useState, useCallback, useMemo, useEffect, type ReactNode } from 'react'
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

/** Reconcile a saved order with the current set of card IDs */
function reconcile(saved: string[], current: string[]): string[] {
  const validIds = new Set(current)
  const result = saved.filter((id) => validIds.has(id))
  for (const id of current) {
    if (!result.includes(id)) result.push(id)
  }
  return result
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

/**
 * Renders the SortableCardContainer component
 * @param {Object} props - Props for the component
 */
export function SortableCardContainer({ cards }: { cards: CardItem[] }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const currentIds = useMemo(() => cards.map((c) => c.id), [cards])

  const [order, setOrder] = useState<string[]>(() => {
    const saved = loadOrder()
    return saved ? reconcile(saved, currentIds) : currentIds
  })

  useEffect(() => {
    const saved = loadOrder()
    setOrder(saved ? reconcile(saved, currentIds) : currentIds)
  }, [currentIds.join(',')])

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
