import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole, requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

/** Rider updates their own location */
export async function POST(req: NextRequest) {
  const auth = await requireRole('RIDER')
  if (auth.error) return auth.error
  const { user } = auth

  const body = await req.json()
  const parsed = LocationSchema.safeParse({
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid latitude/longitude', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { latitude, longitude } = parsed.data
  const admin = createAdminClient()

  await admin
    .from('riders')
    .update({ current_lat: latitude, current_lng: longitude })
    .eq('id', user.rider!.id)

  const { data: active } = await admin
    .from('deliveries')
    .select('id, status')
    .eq('rider_id', user.rider!.id)
    .in('status', ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'])
    .maybeSingle()

  if (active) {
    await admin.from('delivery_tracking').insert({
      delivery_id: active.id,
      latitude,
      longitude,
      status: active.status,
    })
  }

  return NextResponse.json({ message: 'Location updated' })
}

/**
 * View rider location for an order.
 * CUSTOMER → only their own order
 * RIDER    → only if they are assigned to the delivery
 * VENDOR   → only if the order belongs to their store
 * ADMIN    → allowed
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.error) return auth.error
  const { user } = auth

  const orderId = new URL(req.url).searchParams.get('orderId')
  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, customer_id, vendor_id')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  // Explicit role authorization
  if (user.role === 'CUSTOMER') {
    if (!user.customer || order.customer_id !== user.customer.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'VENDOR') {
    if (!user.vendor || order.vendor_id !== user.vendor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'RIDER') {
    // checked below against delivery.rider_id
  } else if (user.role === 'ADMIN') {
    // allowed
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: delivery } = await admin
    .from('deliveries')
    .select(
      `*, rider:riders(id, name, phone, current_lat, current_lng)`
    )
    .eq('order_id', orderId)
    .maybeSingle()

  if (!delivery) {
    return NextResponse.json({ error: 'No delivery' }, { status: 404 })
  }

  if (user.role === 'RIDER') {
    if (!user.rider || delivery.rider_id !== user.rider.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({
    status: delivery.status,
    rider: delivery.rider
      ? {
          name: delivery.rider.name,
          phone: delivery.rider.phone,
          currentLat: delivery.rider.current_lat,
          currentLng: delivery.rider.current_lng,
        }
      : null,
    earnings: delivery.earnings,
  })
}
