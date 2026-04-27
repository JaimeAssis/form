export default function ResponsesLoading() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6 animate-pulse">
        <div className="w-8 h-8 bg-gray-100 rounded" />
        <div className="h-7 bg-gray-100 rounded w-56" />
      </div>
      <div className="h-16 bg-gray-100 rounded-xl mb-6 animate-pulse" />
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border rounded-xl">
            <div className="w-6 h-4 bg-gray-100 rounded" />
            <div className="flex-1 h-4 bg-gray-100 rounded" />
            <div className="w-24 h-4 bg-gray-100 rounded" />
            <div className="w-6 h-6 bg-gray-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
