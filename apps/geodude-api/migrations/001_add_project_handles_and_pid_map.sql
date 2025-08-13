-- Migration: Add project handles and pid_map for project-scoped redirects
-- This enables /p/@handle/pid and host-based project resolution

-- Add public_handle to existing project table
ALTER TABLE project ADD COLUMN public_handle TEXT;

-- Create unique index on public_handle (SQLite doesn't support UNIQUE constraints on ALTER TABLE)
CREATE UNIQUE INDEX idx_project_public_handle ON project(public_handle);

-- Create pid_map table (source of truth for public redirects)
CREATE TABLE pid_map (
    project_id TEXT NOT NULL,
    pid TEXT NOT NULL,
    url TEXT NOT NULL,
    created_ts INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_ts INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (project_id, pid),
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- Create custom_hosts table for host-based project resolution
CREATE TABLE custom_hosts (
    host TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    created_ts INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (project_id) REFERENCES project(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_pid_map_project_pid ON pid_map(project_id, pid);
CREATE INDEX idx_custom_hosts_project ON custom_hosts(project_id);

-- Insert some sample data for testing
-- (You can remove these after testing)
UPDATE project SET public_handle = 'system' WHERE id = 'prj_system';

-- Insert sample PIDs into pid_map
INSERT INTO pid_map (project_id, pid, url) VALUES 
    ('prj_system', 'blog_home', 'https://example.com/blog')
ON CONFLICT(project_id, pid) DO UPDATE SET url = 'https://example.com/blog';
