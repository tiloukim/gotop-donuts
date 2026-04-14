import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const orderId = formData.get('order_id') as string | null
    const deliveryNote = formData.get('delivery_note') as string | null

    if (!orderId) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 })
    }

    const service = createServiceClient()
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }

    // Upload photo if provided
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, or WebP.' }, { status: 400 })
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 })
      }

      const ext = file.name.split('.').pop() || 'jpg'
      const fileName = `delivery/${orderId}-${Date.now()}.${ext}`
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await service.storage
        .from('images')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Delivery photo upload error:', uploadError)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      }

      const { data: { publicUrl } } = service.storage
        .from('images')
        .getPublicUrl(fileName)

      updateData.delivery_photo_url = publicUrl
    }

    if (deliveryNote) {
      updateData.delivery_note = deliveryNote
    }

    const { error: updateError } = await service
      .from('orders')
      .update(updateData)
      .eq('id', orderId)

    if (updateError) {
      console.error('Failed to save delivery info:', updateError)
      return NextResponse.json({ error: 'Failed to save delivery info' }, { status: 500 })
    }

    return NextResponse.json({ url: updateData.delivery_photo_url || null })
  } catch (err) {
    console.error('Delivery photo error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
