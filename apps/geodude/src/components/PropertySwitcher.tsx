import { useState, useEffect } from "react";
import { ChevronDown, Search, Plus, Globe, MoreHorizontal, Edit, Settings, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from "../config";

interface Property {
  id: number;
  project_id: string;
  domain: string;
  created_at: string;
}

interface PropertySwitcherProps {
  onCreateProperty: () => void;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: { id: number; domain: string; project_id?: string } | null;
  onSuccess: () => void;
}

function RenamePropertyModal({ isOpen, onClose, property, onSuccess }: RenameModalProps) {
  const { user, organization } = useAuth();
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user can rename properties
  const canRenameProperties = user?.is_admin || false; // You might need to add org role check here

  useEffect(() => {
    if (isOpen && property) {
      setDomain(property.domain);
      setError(null);
    }
  }, [isOpen, property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !domain.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/properties/${property.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ domain: domain.trim() }),
        ...FETCH_OPTS
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to rename property");
      }
    } catch (error) {
      console.error("Error renaming property:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !property) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Rename Property</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {!canRenameProperties ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Only organization owners or admins can rename properties.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="propertyDomain" className="block text-sm font-medium text-gray-700 mb-2">
                Domain
              </label>
              <input
                type="text"
                id="propertyDomain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="example.com"
                required
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !domain.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Renaming..." : "Rename"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function PropertySwitcher({ onCreateProperty }: PropertySwitcherProps) {
  const { user, organization, project, selectedProperty, setSelectedProperty } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPropertyMenu, setShowPropertyMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Load properties when dropdown opens
  useEffect(() => {
    if (isOpen && project?.id && properties.length === 0) {
      loadProperties();
    }
  }, [isOpen, project?.id]);

  // Set selected property when properties load
  useEffect(() => {
    if (properties.length > 0 && !selectedProperty) {
      setSelectedProperty(properties[0]);
    }
  }, [properties, selectedProperty]);

  const loadProperties = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/properties?project_id=${project.id}`,
        FETCH_OPTS
      );

      if (response.ok) {
        const data = await response.json();
        setProperties(data || []);
      } else {
        console.error("Failed to load properties:", response.status);
      }
    } catch (error) {
      console.error("Error loading properties:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(p =>
    p.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePropertySelect = (selectedProp: Property) => {
    setSelectedProperty(selectedProp);
    setIsOpen(false);
  };

  const handleCreateProperty = () => {
    setIsOpen(false);
    onCreateProperty();
  };

  const handleRenameProperty = () => {
    setShowPropertyMenu(false);
    setShowRenameModal(true);
  };

  const handleRenameSuccess = () => {
    // Refresh properties list
    loadProperties();
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/properties/${selectedProperty.id}`, {
        method: 'DELETE',
        ...FETCH_OPTS
      });

      if (response.ok) {
        // Remove from local state
        setProperties(prev => prev.filter(p => p.id !== selectedProperty.id));
        
        // Clear selected property if it was deleted
        setSelectedProperty(null);
        
        // Close menu
        setShowPropertyMenu(false);
      } else {
        console.error('Failed to delete property');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  if (!user || !organization || !project) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md">
        <Globe className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center min-w-0 overflow-visible" style={{ zIndex: 1000 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-w-0"
      >
        <Globe className="h-4 w-4 text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-900 max-w-48 truncate">
          {selectedProperty ? selectedProperty.domain : "Select property"}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Property Menu Button */}
      <div className="relative">
        <button
          onClick={() => setShowPropertyMenu(!showPropertyMenu)}
          className="flex items-center px-2 py-2 border-t border-r border-b border-gray-300 rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          disabled={!selectedProperty}
        >
          <MoreHorizontal className="h-4 w-4 text-gray-500" />
        </button>

        {/* Property Menu Dropdown */}
        {showPropertyMenu && selectedProperty && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowPropertyMenu(false)}
            />

            {/* Menu */}
            <div className="absolute left-1/2 top-full w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[9999] transform -translate-x-1/2" style={{
              marginTop: '0.5rem'
            }}>
              <div className="py-1">
                <button
                  onClick={handleRenameProperty}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Edit className="h-4 w-4" />
                  <span>Rename property</span>
                </button>
                <button
                  onClick={() => {
                    setShowPropertyMenu(false);
                    // Placeholder for settings panel
                    console.log("Property settings panel coming soon");
                  }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Property settings</span>
                </button>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  onClick={handleDeleteProperty}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Delete property</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute left-1/2 top-full w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-[9999] transform -translate-x-1/2 max-h-[calc(100vh-200px)] overflow-hidden" style={{
            marginTop: '0.5rem'
          }}>
            <div className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Property list */}
              <div className="max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">
                      {searchQuery ? "No properties match your search" : "No properties found"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProperties.map((prop) => (
                      <button
                        key={prop.id}
                        onClick={() => handlePropertySelect(prop)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${prop.id === selectedProperty?.id
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{prop.domain}</span>
                          {prop.id === selectedProperty?.id && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create property button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCreateProperty}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>New property</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Modal */}
      <RenamePropertyModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        property={selectedProperty}
        onSuccess={handleRenameSuccess}
      />
    </div>
  );
}
