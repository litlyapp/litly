export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="h-10 w-48 bg-navy-light rounded-2xl mb-2 animate-pulse" />
      <div className="h-4 w-32 bg-navy-light rounded-full mb-10 animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-navy-light border border-cream/10 rounded-2xl p-5 space-y-3 animate-pulse"
          >
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-cream/10 rounded-full" />
              <div className="h-5 w-12 bg-cream/10 rounded-full" />
            </div>
            <div className="h-5 w-3/4 bg-cream/10 rounded-full" />
            <div className="h-4 w-1/2 bg-cream/10 rounded-full" />
            <div className="h-4 w-2/3 bg-cream/10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
