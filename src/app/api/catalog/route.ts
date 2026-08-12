import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('products')
      .select('*, category:categories(name)')
      .eq('is_active', true)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      products: (data || []).map((p: any) => ({
        id: p.id, name: p.name, unit: p.unit, basePrice: p.base_price,
        image: p.image, category: p.category?.name,
      })),
    })
  } catch (err) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
