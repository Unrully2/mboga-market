import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { distanceKm } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '-1.1714')
    const lng = parseFloat(searchParams.get('lng') || '36.8356')
    const radius = parseFloat(searchParams.get('radius') || '6')
    const search = searchParams.get('q') || searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'nearest'

    const admin = createAdminClient()
    let query = admin
      .from('vendors')
      .select('*, vendor_products(id)')
      .eq('status', 'APPROVED')

    if (search) {
      query = query.or(
        `business_name.ilike.%${search}%,owner_name.ilike.%${search}%,location.ilike.%${search}%`
      )
    }

    const { data: vendors, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let result = (vendors || []).map((v: any) => {
      const dist =
        v.latitude != null && v.longitude != null
          ? distanceKm(lat, lng, v.latitude, v.longitude)
          : 999
      return {
        id: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        location: v.location,
        estate: v.estate,
        rating: v.rating,
        totalReviews: v.total_reviews,
        deliveryFee: v.delivery_fee,
        minOrderAmount: v.min_order_amount,
        isOpen: v.is_open,
        isVerified: v.is_verified,
        profileImage: v.profile_image,
        productCount: v.vendor_products?.length || 0,
        distance: Math.round(dist * 10) / 10,
        latitude: v.latitude,
        longitude: v.longitude,
      }
    })

    // Keep vendors without coords; only distance-filter those that have lat/lng
result = result.filter(
  (v) => v.latitude == null || v.longitude == null || v.distance <= radius
)
if (sort === 'nearest') {
  result.sort((a, b) => {
    const da = a.latitude == null || a.longitude == null ? 9999 : a.distance
    const db = b.latitude == null || b.longitude == null ? 9999 : b.distance
    return da - db
  })
} else if (sort === 'rating') {
  result.sort((a, b) => b.rating - a.rating)
}

    return NextResponse.json({ vendors: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load vendors' }, { status: 500 })
  }
}
