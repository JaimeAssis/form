export default function FormsLoading() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="h-7 bg-gray-100 rounded w-40" />
        <div className="h-9 bg-gray-100 rounded w-36" />
      </div>
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white border rounded-xl">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 rounded w-48" />
              <div className="h-3 bg-gray-100 rounded w-24" />
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="w-8 h-8 bg-gray-100 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
