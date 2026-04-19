import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import webpush from 'web-push'

export async function GET(req: NextRequest) {
  // Vercel cron calls with a secret header
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data: topDeals } = await supabaseAdmin
    .from('deals')
    .select('raw_name, effective_unit_price, unit, stores(name)')
    .gte('sale_end_date', today)
    .not('effective_unit_price', 'is', null)
    .order('effective_unit_price', { ascending: true })
    .limit(5)
    .returns<{ raw_name: string; effective_unit_price: number; unit: string; stores: { name: string } | null }[]>()

  if (!topDeals?.length) return NextResponse.json({ sent: 0 })

  const dealLines = topDeals
    .map((d) => `• ${d.raw_name} — $${d.effective_unit_price}/${d.unit} @ ${d.stores?.name}`)
    .join('\n')

  const payload = JSON.stringify({
    title: '🛒 This week\'s top grocery deals',
    body: dealLines,
    url: '/',
  })

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription')
    .returns<{ subscription: webpush.PushSubscription }[]>()

  if (!subs?.length) return NextResponse.json({ sent: 0 })

  webpush.setVapidDetails(
    'mailto:admin@grocery-deals.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  let sent = 0
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload)
      sent++
    } catch {
      // Subscription expired — remove it
      await supabaseAdmin.from('push_subscriptions').delete().eq('subscription', row.subscription)
    }
  }

  return NextResponse.json({ sent })
}
