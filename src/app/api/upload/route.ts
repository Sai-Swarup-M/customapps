import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAdImage } from '@/lib/extract'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.UPLOAD_API_KEY}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Upload to Supabase Storage
  const filename = `ads/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, '_')}`
  const { data: storageData, error: storageError } = await supabaseAdmin.storage
    .from('ad-images')
    .upload(filename, buffer, { contentType: file.type })

  if (storageError) {
    return NextResponse.json({ error: 'Storage upload failed', detail: storageError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabaseAdmin.storage.from('ad-images').getPublicUrl(storageData.path)

  // Process image with Claude Vision + store in DB
  const result = await processAdImage(buffer, file.type as 'image/jpeg' | 'image/png' | 'image/webp')

  // Update ad row with real image URL
  await supabaseAdmin.from('ads').update({ image_url: publicUrl }).eq('id', result.adId)

  return NextResponse.json({
    ad_id: result.adId,
    store: result.storeName,
    sale_dates: result.saleDates,
    products_found: result.productsFound,
    status: 'processed',
  })
}
