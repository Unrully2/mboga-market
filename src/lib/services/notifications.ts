import { createAdminClient } from '@/lib/supabase/server'

export type NotifyPayload = {
  userId: string
  title: string
  body: string
  type: string
  data?: Record<string, unknown>
  sendSms?: boolean
  phone?: string
}

export async function createNotification(payload: NotifyPayload) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('notifications')
    .insert({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      data: payload.data ? JSON.stringify(payload.data) : null,
    })
    .select()
    .single()

  if (error) console.warn('[notify]', error.message)

  if (payload.sendSms && payload.phone) {
    await sendSms(payload.phone, `${payload.title}: ${payload.body}`).catch((err) =>
      console.warn('[SMS]', err.message)
    )
  }
  return data
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const apiKey = process.env.AFRICASTALKING_API_KEY
  const username = process.env.AFRICASTALKING_USERNAME
  if (!apiKey || !username) {
    console.info('[SMS] credentials not set – skipping')
    return false
  }
  let phone = to.replace(/\s+/g, '')
  if (phone.startsWith('0')) phone = '+254' + phone.slice(1)
  if (phone.startsWith('254')) phone = '+' + phone
  if (!phone.startsWith('+')) phone = '+254' + phone

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      apiKey,
    },
    body: new URLSearchParams({
      username,
      to: phone,
      message,
      from: process.env.AFRICASTALKING_SENDER_ID || 'MBOGA',
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return true
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return false
  let phone = to.replace(/\s+/g, '').replace(/^\+/, '')
  if (phone.startsWith('0')) phone = '254' + phone.slice(1)
  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message },
    }),
  })
  if (!res.ok) throw new Error(await res.text())
  return true
}
