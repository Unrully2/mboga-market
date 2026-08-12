import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      name: user.name,
      customer: user.customer,
      vendor: user.vendor,
      rider: user.rider,
    },
  })
}
