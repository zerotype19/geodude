import React from 'react';
import { CheckCircle, ArrowRight } from 'lucide-react';
import MaskedKey from './MaskedKey';

interface ApiKeySuccessPanelProps {
  keyId: string;
  keyName: string;
  projectId: string;
  onGoToInstall: () => void;
  className?: string;
}

export default function ApiKeySuccessPanel({ 
  keyId, 
  keyName, 
  projectId, 
  onGoToInstall,
  className = ""
}: ApiKeySuccessPanelProps) {
  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start space-x-3">
        <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-green-800 mb-2">
            API Key created
          </h3>
          
          <div className="space-y-3">
            {/* Key ID with masked display */}
            <div>
              <label className="block text-xs font-medium text-green-700 mb-1">
                Key ID:
              </label>
              <MaskedKey 
                value={keyId} 
                className="text-green-800"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onGoToInstall}
                className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
              >
                <ArrowRight size={14} />
                <span>Go to Install</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
