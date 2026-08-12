import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { cartAddSchema, cartUpdateSchema, parseBody, uuidSchema } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = await requireRole('CUSTOMER')
    if (result.error) return result.error
    const { user } = result
    const admin = createAdminClient()
    const { data: items, error } = await admin
      .from('cart_items')
      .select(
        `*, vendor_product:vendor_products (
          id, price, stock_status, is_available, custom_name,
          product:products (name, unit, image),
          vendor:vendors (id, business_name, delivery_fee, min_order_amount, is_open, status)
        )`
      )
      .eq('customer_id', user.customer!.id)

    if (error) {
      console.error('[cart GET]', error)
      return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 })
    }

    const groups: Record<string, any> = {}
    for (const item of items || []) {
      const vp = item.vendor_product
      if (!vp?.vendor) continue
      const vid = vp.vendor.id
      if (!groups[vid]) {
        groups[vid] = {
          vendor: {
            id: vp.vendor.id,
            businessName: vp.vendor.business_name,
            deliveryFee: vp.vendor.delivery_fee,
            minOrderAmount: vp.vendor.min_order_amount,
            isOpen: vp.vendor.is_open,
            status: vp.vendor.status,
          },
          items: [],
          subtotal: 0,
        }
      }
      const line = vp.price * item.quantity
      groups[vid].subtotal += line
      groups[vid].items.push({
        id: item.id,
        quantity: item.quantity,
        instructions: item.instructions,
        vendorProductId: vp.id,
        price: vp.price,
        name: vp.custom_name || vp.product?.name,
        unit: vp.product?.unit,
        image: vp.product?.image,
        stockStatus: vp.stock_status,
        lineTotal: line,
      })
    }

    return NextResponse.json({ groups: Object.values(groups) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load cart' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await requireRole('CUSTOMER')
    if (result.error) return result.error
    const { user } = result

    const body = await req.json()
    const parsed = parseBody(cartAddSchema, {
      vendorProductId: body.vendorProductId,
      quantity: body.quantity != null ? Number(body.quantity) : 1,
      instructions: body.instructions,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid cart data', details: parsed.error },
        { status: 400 }
      )
    }

    const { vendorProductId, quantity, instructions } = parsed.data
    const admin = createAdminClient()
    const { data: existing } = await admin
      .from('cart_items')
      .select('id, quantity')
      .eq('customer_id', user.customer!.id)
      .eq('vendor_product_id', vendorProductId)
      .maybeSingle()

    if (existing) {
      await admin
        .from('cart_items')
        .update({
          quantity: existing.quantity + quantity,
          instructions: instructions ?? undefined,
        })
        .eq('id', existing.id)
        .eq('customer_id', user.customer!.id)
    } else {
      await admin.from('cart_items').insert({
        customer_id: user.customer!.id,
        vendor_product_id: vendorProductId,
        quantity,
        instructions: instructions || null,
      })
    }

    return NextResponse.json({ message: 'Added to cart' })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add to cart' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const result = await requireRole('CUSTOMER')
    if (result.error) return result.error
    const { user } = result

    const body = await req.json()
    const parsed = parseBody(cartUpdateSchema, {
      id: body.id,
      quantity: body.quantity != null ? Number(body.quantity) : undefined,
      instructions: body.instructions,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update', details: parsed.error },
        { status: 400 }
      )
    }

    const { id, quantity, instructions } = parsed.data
    const admin = createAdminClient()
    if (quantity !== undefined && quantity <= 0) {
      await admin
        .from('cart_items')
        .delete()
        .eq('id', id)
        .eq('customer_id', user.customer!.id)
    } else {
      await admin
        .from('cart_items')
        .update({
          ...(quantity !== undefined && { quantity }),
          ...(instructions !== undefined && { instructions }),
        })
        .eq('id', id)
        .eq('customer_id', user.customer!.id)
    }
    return NextResponse.json({ message: 'Updated' })
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const result = await requireRole('CUSTOMER')
    if (result.error) return result.error
    const { user } = result
    const id = new URL(req.url).searchParams.get('id')
    const idCheck = uuidSchema.safeParse(id)
    if (!idCheck.success) {
      return NextResponse.json({ error: 'Valid id required' }, { status: 400 })
    }
    const admin = createAdminClient()
    await admin
      .from('cart_items')
      .delete()
      .eq('id', idCheck.data)
      .eq('customer_id', user.customer!.id)
    return NextResponse.json({ message: 'Removed' })
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
