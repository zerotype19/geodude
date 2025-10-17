export default function ScoreLegend() {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Score Legend</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-800 text-xs font-bold">
            3
          </span>
          <div className="text-xs">
            <div className="font-medium text-gray-900">Exceeds</div>
            <div className="text-gray-500">Best practice</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
            2
          </span>
          <div className="text-xs">
            <div className="font-medium text-gray-900">Meets</div>
            <div className="text-gray-500">Acceptable</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-800 text-xs font-bold">
            1
          </span>
          <div className="text-xs">
            <div className="font-medium text-gray-900">Partial</div>
            <div className="text-gray-500">Needs work</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-800 text-xs font-bold">
            0
          </span>
          <div className="text-xs">
            <div className="font-medium text-gray-900">Missing</div>
            <div className="text-gray-500">Fix now</div>
          </div>
        </div>
      </div>
    </div>
  );
}

