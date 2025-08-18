import { useState, useEffect } from "react";
import { ChevronDown, Search, Plus, Building2 } from "lucide-react";
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

export default function ProjectSwitcher({ onCreateProject }: ProjectSwitcherProps) {
  const { user, organization, project, switchContext } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

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

  if (!user || !organization || !project) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md">
        <Building2 className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Building2 className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900 max-w-32 truncate">
          {project.name}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>

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
    </div>
  );
}
