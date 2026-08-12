'use client'

import { Check } from 'lucide-react'
import clsx from 'clsx'

const STEPS = [
  { key: 'ORDER_RECEIVED', label: 'Order placed' },
  { key: 'PAYMENT_CONFIRMED', label: 'Payment confirmed' },
  { key: 'VENDOR_ACCEPTED', label: 'Vendor accepted' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for pickup' },
  { key: 'RIDER_ASSIGNED', label: 'Rider assigned' },
  { key: 'PICKED_UP', label: 'Picked up' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { key: 'DELIVERED', label: 'Delivered' },
]

// Map intermediate statuses to step index
const STATUS_TO_INDEX: Record<string, number> = {
  PENDING_PAYMENT: -1,
  PAYMENT_CONFIRMED: 1,
  ORDER_RECEIVED: 0,
  VENDOR_ACCEPTED: 2,
  PREPARING: 3,
  READY_FOR_PICKUP: 4,
  RIDER_ASSIGNED: 5,
  PICKED_UP: 6,
  OUT_FOR_DELIVERY: 7,
  DELIVERED: 8,
  COMPLETED: 8,
  CANCELLED: -2,
  REJECTED: -2,
  REFUNDED: -2,
}

type OrderTimelineProps = {
  status: string
  compact?: boolean
}

export function OrderTimeline({ status, compact = false }: OrderTimelineProps) {
  const currentIdx = STATUS_TO_INDEX[status] ?? -1
  const isCancelled = currentIdx === -2

  if (isCancelled) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium">
        Order {status === 'REJECTED' ? 'rejected' : status === 'REFUNDED' ? 'refunded' : 'cancelled'}
      </div>
    )
  }

  if (status === 'PENDING_PAYMENT') {
    return (
      <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800 font-medium">
        Awaiting M-Pesa payment…
      </div>
    )
  }

  const visible = compact
    ? STEPS.filter((_, i) => i <= currentIdx + 1 || i === STEPS.length - 1)
    : STEPS

  return (
    <div className="space-y-0">
      {STEPS.map((step, i) => {
        const done = i <= currentIdx
        const active = i === currentIdx
        return (
          <div key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center border-2 shrink-0',
                  done
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'bg-white border-slate-200 text-slate-300'
                )}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  <span className="text-[10px] font-bold">{i + 1}</span>
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={clsx(
                    'w-0.5 flex-1 min-h-[20px]',
                    i < currentIdx ? 'bg-primary-600' : 'bg-slate-200'
                  )}
                />
              )}
            </div>
            <div className={clsx('pb-4 pt-0.5', active && 'font-semibold')}>
              <p
                className={clsx(
                  'text-sm',
                  done ? 'text-slate-900' : 'text-slate-400',
                  active && 'text-primary-700'
                )}
              >
                {step.label}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
