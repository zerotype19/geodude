import { useState, useEffect } from "react";
import { ChevronDown, Search, Plus, Building2, MoreHorizontal, Edit, Settings } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE, FETCH_OPTS } from "../config";
import { useNavigate } from "react-router-dom";

interface Project {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

interface ProjectSwitcherProps {
  onCreateProject: () => void;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: { id: string; name: string; org_id?: string } | null;
  onSuccess: () => void;
}

function RenameProjectModal({ isOpen, onClose, project, onSuccess }: RenameModalProps) {
  const { user, organization } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user can rename projects
  const canRenameProjects = user?.is_admin || false; // You might need to add org role check here

  useEffect(() => {
    if (isOpen && project) {
      setName(project.name);
      setError(null);
    }
  }, [isOpen, project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/projects/${project.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: name.trim() }),
        ...FETCH_OPTS
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to rename project");
      }
    } catch (error) {
      console.error("Error renaming project:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Rename Project</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {!canRenameProjects ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              Only organization owners or admins can rename projects.
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
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Project name"
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
                disabled={loading || !name.trim()}
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

export default function ProjectSwitcher({ onCreateProject }: ProjectSwitcherProps) {
  const { user, organization, project, switchContext } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Load projects when dropdown opens
  useEffect(() => {
    if (isOpen && organization?.id && projects.length === 0) {
      loadProjects();
    }
  }, [isOpen, organization?.id]);

  const loadProjects = async () => {
    if (!organization?.id) return;

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/projects?org_id=${organization.id}`,
        FETCH_OPTS
      );

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        console.error("Failed to load projects:", response.status);
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectSelect = async (selectedProject: Project) => {
    if (selectedProject.id === project?.id) {
      setIsOpen(false);
      return;
    }

    try {
      // Switch to the selected project
      await switchContext(organization!.id, selectedProject.id);
      
      // Persist last project
      localStorage.setItem('ov:lastProjectId', selectedProject.id);
      
      // Navigate to events
      navigate('/events');
      
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to switch project:", error);
    }
  };

  const handleCreateProject = () => {
    setIsOpen(false);
    onCreateProject();
  };

  const handleRenameProject = () => {
    setShowProjectMenu(false);
    setShowRenameModal(true);
  };

  const handleRenameSuccess = () => {
    // Refresh projects list and context
    loadProjects();
    // The project name will be updated via the context refresh
    if (organization?.id && project?.id) {
      switchContext(organization.id, project.id);
    }
  };

  if (!user || !organization || !project) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md">
        <Building2 className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900 max-w-32 truncate">
          {project.name}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      
      {/* Project Menu Button */}
      <div className="relative">
        <button
          onClick={() => setShowProjectMenu(!showProjectMenu)}
          className="flex items-center px-2 py-2 border-t border-r border-b border-gray-300 rounded-r-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <MoreHorizontal className="h-4 w-4 text-gray-500" />
        </button>

        {/* Project Menu Dropdown */}
        {showProjectMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowProjectMenu(false)}
            />

            {/* Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                <button
                  onClick={handleRenameProject}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Edit className="h-4 w-4" />
                  <span>Rename project</span>
                </button>
                <button
                  onClick={() => {
                    setShowProjectMenu(false);
                    // Placeholder for settings panel
                    console.log("Settings panel coming soon");
                  }}
                  className="flex items-center space-x-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  <span>Danger zone</span>
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
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
            <div className="p-4">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Project list */}
              <div className="max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">
                      {searchQuery ? "No projects match your search" : "No projects found"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredProjects.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleProjectSelect(proj)}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${
                          proj.id === project?.id
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{proj.name}</span>
                          {proj.id === project?.id && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Create project button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCreateProject}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>New project</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rename Modal */}
      <RenameProjectModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        project={project}
        onSuccess={handleRenameSuccess}
      />
    </div>
  );
}
