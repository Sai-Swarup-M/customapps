import UploadDropzone from '@/components/UploadDropzone'

export default function UploadPage() {
  return (
    <main className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Upload Ad</h1>
      <p className="text-sm text-gray-400 mb-6">
        Select an ad image from Photos or Files. Claude will extract every product and price automatically.
      </p>
      <UploadDropzone />

      <div className="mt-8 bg-amber-50 rounded-2xl p-4">
        <p className="text-sm font-semibold text-amber-800 mb-2">Tip: Set up auto-upload</p>
        <p className="text-sm text-amber-700">
          Save ads to a <strong>Grocery Ads</strong> album in Photos, then create an iOS Shortcut to automatically
          send new photos to this app. See Settings for setup instructions.
        </p>
      </div>
    </main>
  )
}
