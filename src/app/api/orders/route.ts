import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser, requireRole } from '@/lib/auth'
import { orderCreateSchema, parseBody } from '@/lib/validation/schemas'
import { initiateStkPush } from '@/lib/mpesa'
import { createNotification } from '@/lib/services/notifications'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    let query = admin
      .from('orders')
      .select(
        `*, vendor:vendors(id, business_name, phone), items:order_items(*), payment:payments(*), delivery:deliveries(*)`
      )
      .order('created_at', { ascending: false })
      .limit(50)

    if (user.role === 'CUSTOMER' && user.customer) {
      query = query.eq('customer_id', user.customer.id)
    } else if (user.role === 'VENDOR' && user.vendor) {
      query = query.eq('vendor_id', user.vendor.id)
    } else if (user.role === 'RIDER' && user.rider) {
      const { data: dels } = await admin
        .from('deliveries')
        .select('order_id')
        .eq('rider_id', user.rider.id)
      const ids = (dels || []).map((d: { order_id: string }) => d.order_id)
      if (ids.length === 0) {
        return NextResponse.json({ orders: [] })
      }
      query = query.in('id', ids)
    } else if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data, error } = await query
    if (error) {
      console.error('[orders GET]', error)
      return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
    }

    const orders = (data || []).map((o: Record<string, unknown>) => {
      const vendor = o.vendor as Record<string, unknown> | null
      return {
        id: o.id,
        orderNumber: o.order_number,
        status: o.status,
        paymentMethod: o.payment_method,
        subtotal: o.subtotal,
        deliveryFee: o.delivery_fee,
        serviceFee: o.service_fee,
        discount: o.discount,
        total: o.total,
        createdAt: o.created_at,
        vendor: vendor
          ? {
              id: vendor.id,
              businessName: vendor.business_name,
              phone: vendor.phone,
            }
          : null,
        items: o.items || [],
        payment: o.payment,
        delivery: o.delivery,
      }
    })

    return NextResponse.json({ orders })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole('CUSTOMER')
    if (auth.error) return auth.error
    const { user } = auth

    const raw = await req.json()
    const parsed = parseBody(orderCreateSchema, {
      vendorId: raw.vendorId,
      addressId: raw.addressId ?? null,
      promoCode: raw.promoCode ?? null,
      deliveryNotes: raw.deliveryNotes ?? null,
      preferredTime: raw.preferredTime ?? null,
      paymentMethod: raw.paymentMethod || 'MPESA',
      phone: raw.phone ?? null,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid order', details: parsed.error },
        { status: 400 }
      )
    }

    const {
      vendorId,
      addressId,
      paymentMethod,
      deliveryNotes,
      preferredTime,
      promoCode,
      phone,
    } = parsed.data

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('create_order', {
      p_customer_user_id: user.id,
      p_vendor_id: vendorId,
      p_address_id: addressId || null,
      p_payment_method: paymentMethod,
      p_delivery_notes: deliveryNotes || null,
      p_preferred_time: preferredTime || null,
      p_promo_code: promoCode || null,
      p_phone: phone || user.phone,
      p_service_fee: Number(process.env.SERVICE_FEE || 10),
    })

    if (error) {
      const msg = error.message || ''
      const map: Record<string, string> = {
        UNAUTHORIZED_CUSTOMER: 'Not authorized as customer',
        VENDOR_UNAVAILABLE: 'Vendor is closed or unavailable',
        INVALID_ADDRESS: 'Invalid delivery address',
        EMPTY_CART: 'Cart is empty for this vendor',
        INVALID_PROMO: 'Promo code is invalid or expired',
        PROMO_EXHAUSTED: 'Promo usage limit reached',
        PROMO_MIN_ORDER: 'Order does not meet promo minimum',
      }
      let friendly = msg
      for (const [k, v] of Object.entries(map)) {
        if (msg.includes(k)) {
          friendly = v
          break
        }
      }
      if (msg.includes('OUT_OF_STOCK') || msg.includes('INSUFFICIENT_STOCK')) {
        friendly = msg
          .replace('OUT_OF_STOCK:', 'Out of stock: ')
          .replace('INSUFFICIENT_STOCK:', 'Not enough stock: ')
      }
      if (msg.includes('BELOW_MIN_ORDER')) {
        friendly = 'Order is below vendor minimum amount'
      }
      return NextResponse.json({ error: friendly }, { status: 400 })
    }

    const result = data as {
      order_id: string
      order_number: string
      status: string
      total: number
      subtotal: number
      delivery_fee: number
      service_fee: number
      discount: number
    }

    if (paymentMethod === 'CASH_ON_DELIVERY') {
      try {
        const { data: vendor } = await admin
          .from('vendors')
          .select('user_id, phone')
          .eq('id', vendorId)
          .single()
        if (vendor) {
          await createNotification({
            userId: vendor.user_id,
            title: 'New order',
            body: `Order ${result.order_number} · KES ${result.total}`,
            type: 'ORDER',
            data: { orderId: result.order_id },
            sendSms: true,
            phone: vendor.phone,
          })
        }
      } catch {
        /* non-fatal */
      }
    }

    let mpesaResult = null
    if (paymentMethod === 'MPESA') {
      mpesaResult = await initiateStkPush({
        phone: phone || user.phone,
        amount: result.total,
        orderId: result.order_id,
        accountReference: result.order_number,
        transactionDesc: `Mboga ${result.order_number}`,
      })
    }

    return NextResponse.json({
      order: {
        id: result.order_id,
        orderNumber: result.order_number,
        status: result.status,
        total: result.total,
        subtotal: result.subtotal,
        deliveryFee: result.delivery_fee,
        serviceFee: result.service_fee,
        discount: result.discount,
      },
      mpesa: mpesaResult,
      message:
        paymentMethod === 'MPESA'
          ? mpesaResult?.success
            ? 'Order created. Check your phone for M-Pesa prompt.'
            : `Order created. M-Pesa: ${mpesaResult?.message}`
          : 'Order placed (Cash on Delivery)',
    })
  } catch (err) {
    console.error('Order create error', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
