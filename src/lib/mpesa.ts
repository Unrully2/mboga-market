/**
 * M-Pesa Daraja STK Push — server only. No Prisma.
 * Uses Supabase admin client for payment/order updates.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/services/notifications'

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

/** Daraja requires timestamp in Africa/Nairobi (EAT, UTC+3), not server local time. */
function timestamp(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((x) => x.type === type)?.value || '00'
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`
}

export type StkParams = {
  phone: string
  amount: number
  orderId: string
  accountReference: string
  transactionDesc: string
}

export async function initiateStkPush(
  params: StkParams
): Promise<{ success: boolean; message: string; checkoutRequestId?: string }> {
  const shortcode = process.env.MPESA_SHORTCODE
  const passkey = process.env.MPESA_PASSKEY
  const callbackUrl = process.env.MPESA_CALLBACK_URL

  if (!shortcode || !passkey || !callbackUrl) {
    return {
      success: false,
      message:
        'M-Pesa not configured. Set MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL.',
    }
  }

  const token = await getAccessToken()
  if (!token) {
    return { success: false, message: 'Could not get M-Pesa access token' }
  }

  let phone = params.phone.replace(/\s+/g, '')
  if (phone.startsWith('0')) phone = '254' + phone.slice(1)
  if (phone.startsWith('+')) phone = phone.slice(1)

  const ts = timestamp()
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64')

  try {
    const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: params.accountReference.slice(0, 12),
        TransactionDesc: params.transactionDesc.slice(0, 13),
      }),
    })
    const data = await res.json()

    if (data.ResponseCode === '0' || data.CheckoutRequestID) {
      const admin = createAdminClient()
      await admin
        .from('payments')
        .update({
          checkout_request_id: data.CheckoutRequestID,
          merchant_request_id: data.MerchantRequestID,
          status: 'PROCESSING',
        })
        .eq('order_id', params.orderId)

      return {
        success: true,
        message: data.CustomerMessage || 'STK Push sent',
        checkoutRequestId: data.CheckoutRequestID,
      }
    }

    return {
      success: false,
      message: data.errorMessage || data.ResponseDescription || 'STK Push failed',
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' }
  }
}

/** Process STK callback — only mark COMPLETED when ResultCode === 0.
 * Order status goes PENDING_PAYMENT → PAYMENT_CONFIRMED → ORDER_RECEIVED via transition_order_status.
 * Fully idempotent: second delivery of same callback is a no-op.
 */
export async function handleStkCallback(body: any) {
  const admin = createAdminClient()
  const callback = body?.Body?.stkCallback
  if (!callback) return

  const resultCode = callback.ResultCode
  const checkoutRequestId = callback.CheckoutRequestID
  if (!checkoutRequestId) return

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('checkout_request_id', checkoutRequestId)
    .maybeSingle()

  if (!payment) {
    console.warn('[M-Pesa] No payment for CheckoutRequestID', checkoutRequestId)
    return
  }

  // Fully idempotent — do not reprocess
  if (payment.status === 'COMPLETED' || payment.callback_processed_at) {
    console.info('[M-Pesa] Callback already processed for', checkoutRequestId)
    return
  }

  // Claim processing atomically (optimistic lock)
  const { data: claimed, error: claimErr } = await admin
    .from('payments')
    .update({
      raw_callback: JSON.stringify(body).slice(0, 4000),
      status: resultCode === 0 ? 'PROCESSING' : 'FAILED',
    })
    .eq('id', payment.id)
    .is('callback_processed_at', null)
    .neq('status', 'COMPLETED')
    .select()
    .maybeSingle()

  if (claimErr || !claimed) {
    console.info('[M-Pesa] Could not claim payment (already processing)', checkoutRequestId)
    return
  }

  if (resultCode === 0) {
    const items = callback.CallbackMetadata?.Item || []
    const receipt = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value

    // Mark payment completed + processed BEFORE status transitions (idempotency gate)
    await admin
      .from('payments')
      .update({
        status: 'COMPLETED',
        mpesa_receipt: receipt ? String(receipt) : null,
        callback_processed_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    // Secure status flow via DB function (not direct order update)
    await admin.rpc('transition_order_status', {
      p_order_id: payment.order_id,
      p_new_status: 'PAYMENT_CONFIRMED',
      p_actor_user_id: null,
      p_actor_role: 'SYSTEM',
      p_note: `M-Pesa paid${receipt ? ` · ${receipt}` : ''}`,
    })

    await admin.rpc('transition_order_status', {
      p_order_id: payment.order_id,
      p_new_status: 'ORDER_RECEIVED',
      p_actor_user_id: null,
      p_actor_role: 'SYSTEM',
      p_note: 'Order received by vendor',
    })

    try {
      const { data: order } = await admin
        .from('orders')
        .select('*, vendor:vendors(*), customer:customers(*)')
        .eq('id', payment.order_id)
        .single()

      if (order?.vendor) {
        await createNotification({
          userId: order.vendor.user_id,
          title: 'New paid order',
          body: `Order ${order.order_number} · KES ${order.total} (M-Pesa paid)`,
          type: 'ORDER',
          data: { orderId: order.id },
          sendSms: true,
          phone: order.vendor.phone,
        })
      }
      if (order?.customer?.user_id) {
        await createNotification({
          userId: order.customer.user_id,
          title: 'Payment confirmed',
          body: `Payment for ${order.order_number} received.`,
          type: 'PAYMENT',
          data: { orderId: order.id },
        })
      }
    } catch (e) {
      console.warn('[M-Pesa] notify failed', e)
    }
  } else {
    await admin
      .from('payments')
      .update({
        status: 'FAILED',
        callback_processed_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
  }
}
