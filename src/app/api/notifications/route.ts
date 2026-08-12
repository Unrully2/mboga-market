import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { notificationMarkSchema, parseBody } from '@/lib/validation/schemas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await requireRole(['CUSTOMER', 'VENDOR', 'RIDER', 'ADMIN'])
  if (result.error) return result.error
  const { user } = result

  const admin = createAdminClient()
  const { data } = await admin
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (data || []).map((n: any) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    data: n.data,
    isRead: n.is_read,
    createdAt: n.created_at,
  }))

  return NextResponse.json({
    notifications,
    unread: notifications.filter((n) => !n.isRead).length,
  })
}

export async function PATCH(req: NextRequest) {
  const result = await requireRole(['CUSTOMER', 'VENDOR', 'RIDER', 'ADMIN'])
  if (result.error) return result.error
  const { user } = result

  const raw = await req.json()
  const parsed = parseBody(notificationMarkSchema, {
    id: raw.id || undefined,
    markAll: raw.markAll,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error }, { status: 400 })
  }
  const { id, markAll } = parsed.data
  const admin = createAdminClient()

  if (markAll) {
    await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
  } else if (id) {
    // Ownership: only own notifications
    await admin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ message: 'Updated' })
}
