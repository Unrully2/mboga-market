import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = createAdminClient()
    const { data: v, error } = await admin
      .from('vendors')
      .select(
        `*, vendor_products (
          id, price, stock_status, is_available, custom_name, image,
          product:products (id, name, unit, image, description, category:categories(name))
        )`
      )
      .eq('id', params.id)
      .single()

    if (error || !v) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    return NextResponse.json({
      vendor: {
        id: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        phone: v.phone,
        location: v.location,
        estate: v.estate,
        description: v.description,
        rating: v.rating,
        totalReviews: v.total_reviews,
        deliveryFee: v.delivery_fee,
        minOrderAmount: v.min_order_amount,
        isOpen: v.is_open,
        isVerified: v.is_verified,
        profileImage: v.profile_image,
        products: (v.vendor_products || [])
          .filter((vp: any) => vp.is_available)
          .map((vp: any) => ({
            id: vp.id,
            price: vp.price,
            stockStatus: vp.stock_status,
            name: vp.custom_name || vp.product?.name,
            unit: vp.product?.unit,
            image: vp.image || vp.product?.image,
            description: vp.product?.description,
            category: vp.product?.category?.name,
            productId: vp.product?.id,
          })),
      },
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
