import { useState, useEffect } from "react";
import { X, Copy, Eye, EyeOff, AlertTriangle } from "lucide-react";

interface KeyRotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  keyId: number;
  keyName: string;
  onRotate: (keyId: number, immediate: boolean) => Promise<void>;
}

interface RotationResult {
    key_id: string;
    new_secret_once: string;
    grace_expires_at?: string;
    message: string;
}

export default function KeyRotationModal({
    isOpen,
    onClose,
    keyId,
    keyName,
    onRotate
}: KeyRotationModalProps) {
    const [immediate, setImmediate] = useState(false);
    const [isRotating, setIsRotating] = useState(false);
    const [rotationResult, setRotationResult] = useState<RotationResult | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [secretDisplayTime, setSecretDisplayTime] = useState<number | null>(null);

    // Auto-hide secret after 5 minutes
    useEffect(() => {
        if (rotationResult?.new_secret_once && !secretDisplayTime) {
            const time = Date.now();
            setSecretDisplayTime(time);

            const timer = setTimeout(() => {
                setShowSecret(false);
            }, 5 * 60 * 1000); // 5 minutes

            return () => clearTimeout(timer);
        }
    }, [rotationResult, secretDisplayTime]);

      const handleRotate = async () => {
    setIsRotating(true);
    try {
      await onRotate(keyId, immediate);
      // The parent component should handle the actual rotation
      // and pass the result back via a callback
    } catch (error) {
      console.error("Rotation failed:", error);
    } finally {
      setIsRotating(false);
    }
  };

    const handleCopySecret = async () => {
        if (rotationResult?.new_secret_once) {
            try {
                await navigator.clipboard.writeText(rotationResult.new_secret_once);
                // Could add a toast notification here
            } catch (error) {
                console.error("Failed to copy secret:", error);
            }
        }
    };

    const formatGraceExpiry = (expiry: string) => {
        const expiryDate = new Date(expiry);
        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${diffHours}h ${diffMinutes}m remaining`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Rotate API Key
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!rotationResult ? (
                        <>
                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-4">
                                    You're about to rotate the API key <strong>"{keyName}"</strong>.
                                </p>

                                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                                    <div className="flex items-start">
                                        <AlertTriangle className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" size={16} />
                                        <div className="text-sm text-blue-800">
                                            <p className="font-medium mb-1">Choose your rotation strategy:</p>
                                            <p className="mb-2">
                                                <strong>Grace Period (Recommended):</strong> Keep the old secret valid for 24 hours so your traffic doesn't drop.
                                            </p>
                                            <p>
                                                <strong>Immediate:</strong> Cut over immediately. Any requests using the old secret will fail.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Rotation Options */}
                            <div className="space-y-3 mb-6">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={!immediate}
                                        onChange={() => setImmediate(false)}
                                        className="mr-3 text-blue-600"
                                    />
                                    <div>
                                        <span className="font-medium">Grace Period Rotation</span>
                                        <p className="text-sm text-gray-500">24-hour grace period for seamless transition</p>
                                    </div>
                                </label>

                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={immediate}
                                        onChange={() => setImmediate(true)}
                                        className="mr-3 text-blue-600"
                                    />
                                    <div>
                                        <span className="font-medium">Immediate Rotation</span>
                                        <p className="text-sm text-gray-500">Cut over immediately (may cause downtime)</p>
                                    </div>
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex space-x-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRotate}
                                    disabled={isRotating}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isRotating ? "Rotating..." : "Rotate Key"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Success State */}
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <div className="w-8 h-8 bg-green-600 rounded-full"></div>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Key Rotated Successfully!
                                </h3>
                                <p className="text-sm text-gray-600">
                                    {rotationResult.message}
                                </p>
                            </div>

                            {/* New Secret Display */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    New Secret (Copy this now - it won't be shown again!)
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="flex-1 relative">
                                        <input
                                            type={showSecret ? "text" : "password"}
                                            value={rotationResult.new_secret_once}
                                            readOnly
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
                                        />
                                        <button
                                            onClick={() => setShowSecret(!showSecret)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleCopySecret}
                                        className="px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                                        title="Copy to clipboard"
                                    >
                                        <Copy size={16} />
                                    </button>
                                </div>

                                {secretDisplayTime && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Secret will be hidden in {Math.max(0, Math.floor((secretDisplayTime + 5 * 60 * 1000 - Date.now()) / 1000))}s
                                    </p>
                                )}
                            </div>

                            {/* Grace Period Info */}
                            {rotationResult.grace_expires_at && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                                    <div className="flex items-start">
                                        <AlertTriangle className="text-yellow-600 mt-0.5 mr-2 flex-shrink-0" size={16} />
                                        <div className="text-sm text-yellow-800">
                                            <p className="font-medium mb-1">Grace Period Active</p>
                                            <p className="mb-2">
                                                The old secret will remain valid until: <strong>{formatGraceExpiry(rotationResult.grace_expires_at)}</strong>
                                            </p>
                                            <p>
                                                Update your implementation with the new secret before the grace period expires.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Edge Worker Note */}
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
                                <div className="text-sm text-blue-800">
                                    <p className="font-medium mb-1">Edge Worker Customers</p>
                                    <p>
                                        If you use the Customer Edge Worker, update its stored secret within 24 hours to avoid service interruption.
                                    </p>
                                </div>
                            </div>

                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Done
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
