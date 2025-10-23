export default function ScoreLegend() {
  return (
    <div className="bg-surface-1 shadow rounded-lg p-6">
      <h3 className="text-sm font-medium  mb-3">Score Legend</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-success-soft text-success text-xs font-bold">
            3
          </span>
          <div className="text-xs">
            <div className="font-medium ">Exceeds</div>
            <div className="subtle">Best practice</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-warn-soft text-warn text-xs font-bold">
            2
          </span>
          <div className="text-xs">
            <div className="font-medium ">Meets</div>
            <div className="subtle">Acceptable</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-warn-soft text-warn text-xs font-bold">
            1
          </span>
          <div className="text-xs">
            <div className="font-medium ">Partial</div>
            <div className="subtle">Needs work</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-danger-soft text-danger text-xs font-bold">
            0
          </span>
          <div className="text-xs">
            <div className="font-medium ">Missing</div>
            <div className="subtle">Fix now</div>
          </div>
        </div>
      </div>
    </div>
  );
}

