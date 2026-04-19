'use client'

import { useState, useRef } from 'react'

type UploadResult = {
  store: string
  products_found: number
  sale_dates: { start: string | null; end: string | null }
}

export default function UploadDropzone() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setStatus('uploading')
    setResult(null)
    setError('')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_UPLOAD_API_KEY}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setResult(data)
      setStatus('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
      setStatus('error')
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return
    upload(files[0])
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-green-200 rounded-2xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="text-4xl mb-3">📸</div>
        <p className="font-medium text-gray-700">Tap to upload an ad image</p>
        <p className="text-sm text-gray-400 mt-1">JPG, PNG, HEIC — from Photos or Files</p>
      </div>

      {status === 'uploading' && (
        <div className="bg-blue-50 rounded-2xl p-4 text-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm text-blue-700">Reading ad with Claude Vision...</p>
        </div>
      )}

      {status === 'success' && result && (
        <div className="bg-green-50 rounded-2xl p-4">
          <p className="font-semibold text-green-800">Ad processed</p>
          <p className="text-sm text-green-700 mt-1">{result.store}</p>
          <p className="text-sm text-gray-600">
            {result.products_found} products found
            {result.sale_dates.start && ` · Valid ${result.sale_dates.start} to ${result.sale_dates.end}`}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 rounded-2xl p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )
}
