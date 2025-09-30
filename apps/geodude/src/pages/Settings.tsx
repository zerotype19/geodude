import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE, FETCH_OPTS } from '../config';
import Shell from '../components/Shell';
import { Plus, Trash2, RefreshCw, Globe, Key, Users, Settings as SettingsIcon } from 'lucide-react';

interface Property {
  id: number;
  project_id: string;
  domain: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  organization_id: string;
  created_ts: number;
  primary_property?: Property;
}

const Settings: React.FC = () => {
  const { user, project } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropertyDomain, setNewPropertyDomain] = useState('');
  const [isAddingProperty, setIsAddingProperty] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (project?.id) {
      fetchProperties();
    }
  }, [project?.id]);

  const fetchProperties = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/properties?project_id=${project.id}`, FETCH_OPTS);
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      } else {
        console.error('Failed to fetch properties');
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const addProperty = async () => {
    if (!project?.id || !newPropertyDomain.trim()) return;

    setIsAddingProperty(true);
    setAddError('');
    
    try {
      const response = await fetch(`${API_BASE}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...FETCH_OPTS,
        body: JSON.stringify({
          project_id: project.id,
          domain: newPropertyDomain.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setProperties(prev => [data.property, ...prev]);
        setNewPropertyDomain('');
        setShowAddProperty(false);
        setAddError('');
      } else {
        const errorData = await response.json();
        setAddError(errorData.message || 'Failed to add property');
      }
    } catch (error) {
      setAddError('Network error occurred');
    } finally {
      setIsAddingProperty(false);
    }
  };

  const deleteProperty = async (propertyId: number) => {
    if (!confirm('Are you sure you want to delete this property? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/properties/${propertyId}`, {
        method: 'DELETE',
        ...FETCH_OPTS
      });

      if (response.ok) {
        setProperties(prev => prev.filter(p => p.id !== propertyId));
      } else {
        console.error('Failed to delete property');
      }
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please sign in to view settings</h1>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please select a project first</h1>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Manage your project settings and properties
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Project Information */}
          <Card>
            <div className="p-6">
              <div className="flex items-center mb-4">
                <SettingsIcon className="h-6 w-6 text-gray-400 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">Project Information</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Project Name</label>
                  <p className="mt-1 text-sm text-gray-900">{project.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Project ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono">{project.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(project.created_ts * 1000).toLocaleDateString()}
                  </p>
                </div>
                {project.primary_property && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Primary Property</label>
                    <p className="mt-1 text-sm text-gray-900">{project.primary_property.domain}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Properties Management */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Globe className="h-6 w-6 text-gray-400 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">Properties</h2>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={fetchProperties}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowAddProperty(true)}
                    className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Property
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-600">Loading properties...</p>
                </div>
              ) : properties.length === 0 ? (
                <div className="text-center py-8">
                  <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
                  <p className="text-gray-600 mb-4">Add a property to start tracking events.</p>
                  <button
                    onClick={() => setShowAddProperty(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Property
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {properties.map((property) => (
                    <div key={property.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <Globe className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{property.domain}</p>
                          <p className="text-xs text-gray-500">
                            Added {new Date(property.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteProperty(property.id)}
                        className="inline-flex items-center px-2 py-1 border border-red-300 rounded-md text-xs font-medium text-red-700 bg-white hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Add Property Modal */}
        {showAddProperty && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Property</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
                    <input
                      type="text"
                      value={newPropertyDomain}
                      onChange={(e) => setNewPropertyDomain(e.target.value)}
                      placeholder="example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {addError && (
                    <div className="text-red-600 text-sm">{addError}</div>
                  )}
                  <div className="text-sm text-gray-600">
                    <p>• Enter the domain you want to track (e.g., example.com)</p>
                    <p>• Don't include http:// or https://</p>
                    <p>• This will be used to identify your website in analytics</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowAddProperty(false);
                        setNewPropertyDomain('');
                        setAddError('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addProperty}
                      disabled={isAddingProperty || !newPropertyDomain.trim()}
                      className="flex-1 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAddingProperty ? 'Adding...' : 'Add Property'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default Settings;