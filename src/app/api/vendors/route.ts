import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { distanceKm } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = parseFloat(searchParams.get('lat') || '-1.1714')
    const lng = parseFloat(searchParams.get('lng') || '36.8356')
    // Wide default so pilot/testing vendors still appear
    const radius = parseFloat(searchParams.get('radius') || '50')
    const search = searchParams.get('q') || searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'nearest'

    const admin = createAdminClient()

    // Prefer nested product count; fall back if relation fails
    let vendors: any[] | null = null
    let error: { message: string } | null = null

    {
      let query = admin
        .from('vendors')
        .select('*, vendor_products(id)')
        .eq('status', 'APPROVED')

      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,owner_name.ilike.%${search}%,location.ilike.%${search}%`
        )
      }

      const res = await query
      vendors = res.data
      error = res.error
    }

    if (error) {
      // Fallback without nested select (avoids relation/schema issues)
      let query = admin.from('vendors').select('*').eq('status', 'APPROVED')
      if (search) {
        query = query.or(
          `business_name.ilike.%${search}%,owner_name.ilike.%${search}%,location.ilike.%${search}%`
        )
      }
      const res = await query
      vendors = res.data
      error = res.error
    }

    if (error) {
      console.error('[vendors]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let result = (vendors || []).map((v: any) => {
      const hasCoords = v.latitude != null && v.longitude != null
      const dist = hasCoords
        ? distanceKm(lat, lng, Number(v.latitude), Number(v.longitude))
        : null
      return {
        id: v.id,
        businessName: v.business_name,
        ownerName: v.owner_name,
        location: v.location,
        estate: v.estate,
        rating: v.rating ?? 0,
        totalReviews: v.total_reviews ?? 0,
        deliveryFee: v.delivery_fee,
        minOrderAmount: v.min_order_amount,
        isOpen: v.is_open,
        isVerified: v.is_verified,
        profileImage: v.profile_image,
        productCount: Array.isArray(v.vendor_products)
          ? v.vendor_products.length
          : 0,
        distance: dist != null ? Math.round(dist * 10) / 10 : null,
        latitude: v.latitude,
        longitude: v.longitude,
      }
    })

    // Only apply radius when vendor has coordinates.
    // Vendors without lat/lng are always included when APPROVED.
    result = result.filter(
      (v) => v.distance == null || v.distance <= radius
    )

    if (sort === 'nearest') {
      result.sort((a, b) => {
        const da = a.distance == null ? Number.POSITIVE_INFINITY : a.distance
        const db = b.distance == null ? Number.POSITIVE_INFINITY : b.distance
        return da - db
      })
    } else if (sort === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }

    return NextResponse.json({ vendors: result })
  } catch (err: any) {
    console.error('[vendors]', err)
    return NextResponse.json(
      { error: err?.message || 'Failed to load vendors' },
      { status: 500 }
    )
  }
}
