import { createAdminClient } from '@/lib/supabase/server'

const MPESA_ENV = process.env.MPESA_ENV || 'sandbox'
const BASE_URL =
  MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke'

async function getAccessToken(): Promise<string | null> {
  const key = process.env.MPESA_CONSUMER_KEY
  const secret = process.env.MPESA_CONSUMER_SECRET
  if (!key || !secret) return null
  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${auth}` } }
  )
  const data = await res.json()
  return data.access_token || null
}

export type B2CParams = {
  phone: string
  amount: number
  remarks: string
  occasion?: string
  /** Stored as originator_conversation_id — typically the vendor_payouts.id */
  originatorConversationId: string
}

export async function initiateB2CPayout(
  params: B2CParams
): Promise<{
  success: boolean
  conversationId?: string
  originatorConversationId?: string
  message: string
}> {
  const shortcode = process.env.MPESA_B2C_SHORTCODE
  const initiator = process.env.MPESA_B2C_INITIATOR_NAME
  const securityCredential = process.env.MPESA_B2C_SECURITY_CREDENTIAL
  const resultUrl = process.env.MPESA_B2C_RESULT_URL
  const timeoutUrl = process.env.MPESA_B2C_QUEUE_TIMEOUT_URL

  if (!shortcode || !initiator || !securityCredential || !resultUrl || !timeoutUrl) {
    return {
      success: false,
      message: 'M-Pesa B2C not configured. Set MPESA_B2C_* env vars.',
    }
  }

  const token = await getAccessToken()
  if (!token) return { success: false, message: 'Could not get M-Pesa access token' }

  let phone = params.phone.replace(/\s+/g, '')
  if (phone.startsWith('0')) phone = '254' + phone.slice(1)
  if (phone.startsWith('+')) phone = phone.slice(1)

  const originatorId = params.originatorConversationId

  try {
    const res = await fetch(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        InitiatorName: initiator,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: Math.round(params.amount),
        PartyA: shortcode,
        PartyB: phone,
        Remarks: params.remarks.slice(0, 100),
        QueueTimeOutURL: timeoutUrl,
        ResultURL: resultUrl,
        Occasion: params.occasion || 'Mboga Market Payout',
        OriginatorConversationID: originatorId,
      }),
    })
    const data = await res.json()
    if (data.ConversationID || data.OriginatorConversationID) {
      return {
        success: true,
        conversationId: data.ConversationID || undefined,
        originatorConversationId: data.OriginatorConversationID || originatorId,
        message: data.ResponseDescription || 'B2C request accepted',
      }
    }
    return {
      success: false,
      message: data.errorMessage || data.ResponseDescription || 'B2C failed',
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' }
  }
}

export async function createVendorPayoutRecord(
  vendorId: string,
  amount: number,
  periodStart: Date,
  periodEnd: Date
) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vendor_payouts')
    .insert({
      vendor_id: vendorId,
      amount,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      status: 'PENDING',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markVendorPayoutPaid(payoutId: string, mpesaRef: string) {
  const admin = createAdminClient()
  return admin
    .from('vendor_payouts')
    .update({
      status: 'PAID',
      mpesa_ref: mpesaRef,
      paid_at: new Date().toISOString(),
      callback_processed_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .neq('status', 'PAID')
}
