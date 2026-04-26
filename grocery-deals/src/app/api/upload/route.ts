import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { processAdImage } from '@/lib/extract'
import { config } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${config.uploadApiKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Accept either multipart/form-data (web UI) or JSON base64 (iOS Shortcuts)
    const contentType = req.headers.get('content-type') ?? ''
    let buffer: Buffer
    let mimeType: string
    let fileName: string

    if (contentType.includes('application/json')) {
      const body = await req.json() as { image?: string; mime_type?: string; filename?: string }
      if (!body.image) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
      buffer = Buffer.from(body.image, 'base64')
      mimeType = body.mime_type ?? 'image/jpeg'
      fileName = body.filename ?? `upload-${Date.now()}.jpg`
    } else {
      const formData = await req.formData()
      const file = formData.get('image') as File | null
      if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      buffer = Buffer.from(bytes)
      mimeType = file.type
      fileName = file.name
    }

    // Upload to Supabase Storage
    const storagePath = `ads/${Date.now()}-${fileName.replace(/[^a-z0-9.]/gi, '_')}`
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('ad-images')
      .upload(storagePath, buffer, { contentType: mimeType })

    if (storageError) {
      return NextResponse.json({ error: 'Storage upload failed', detail: storageError.message }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage.from('ad-images').getPublicUrl(storageData.path)

    // Process image with Claude Vision + store in DB
    const result = await processAdImage(buffer, mimeType as 'image/jpeg' | 'image/png' | 'image/webp')

    // Update ad row with real image URL
    await supabaseAdmin.from('ads').update({ image_url: publicUrl }).eq('id', result.adId)

    return NextResponse.json({
      ad_id: result.adId,
      store: result.storeName,
      sale_dates: result.saleDates,
      products_found: result.productsFound,
      status: 'processed',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    console.error('[upload]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
