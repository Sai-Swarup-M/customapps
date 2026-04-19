import ChatInterface from '@/components/ChatInterface'

export default function ChatPage() {
  return (
    <main className="flex flex-col h-[calc(100dvh-56px)]">
      <div className="px-4 pt-6 pb-3 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-900">Ask About Deals</h1>
        <p className="text-sm text-gray-400 mt-0.5">Powered by Claude</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </main>
  )
}
