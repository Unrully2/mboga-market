import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { deliveryStatusSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

const ORDER_STATUS_MAP: Record<string, string> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
}

const DELIVERY_STATUS_MAP: Record<string, string> = {
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  OUT_FOR_DELIVERY: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole('RIDER')
  if (auth.error) return auth.error
  const { user } = auth

  const idCheck = uuidSchema.safeParse(params.id)
  if (!idCheck.success) {
    return NextResponse.json({ error: 'Invalid delivery id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = parseBody(deliveryStatusSchema, body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid status', details: parsed.error },
      { status: 400 }
    )
  }

  const { status } = parsed.data
  const deliveryStatus = DELIVERY_STATUS_MAP[status]
  const orderStatus = ORDER_STATUS_MAP[status]

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('rider_update_delivery_status', {
    p_delivery_id: idCheck.data,
    p_rider_user_id: user.id,
    p_delivery_status: deliveryStatus,
    p_order_status: orderStatus,
  })

  if (error) {
    console.error('[delivery status]', error)
    const msg = error.message || ''
    if (msg.includes('DELIVERY_NOT_FOUND')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (msg.includes('FORBIDDEN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (msg.includes('INVALID_TRANSITION')) {
      return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not update delivery' }, { status: 400 })
  }

  return NextResponse.json({
    message: `Status ${deliveryStatus}`,
    result: data,
  })
}
