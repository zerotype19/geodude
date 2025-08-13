import { Range, lastNDays } from "../dateRange";

interface RangePickerProps {
  value: Range;
  onChange: (range: Range) => void;
}

export default function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-sm font-medium text-slate-700">Time Range:</span>
      <button 
        onClick={() => onChange(lastNDays(1))} 
        className={`px-3 py-1 text-sm rounded-md border ${
          value.from === lastNDays(1).from ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        24h
      </button>
      <button 
        onClick={() => onChange(lastNDays(7))} 
        className={`px-3 py-1 text-sm rounded-md border ${
          value.from === lastNDays(7).from ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        7d
      </button>
      <button 
        onClick={() => onChange(lastNDays(30))} 
        className={`px-3 py-1 text-sm rounded-md border ${
          value.from === lastNDays(30).from ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        }`}
      >
        30d
      </button>
    </div>
  );
}
