import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useApi } from '@/hooks/use-api';
import type { PaginatedResponse, Project } from '@/types/api';

interface ProjectContextValue {
  projects: Project[];
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string) => void;
  loading: boolean;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const {
    data: projectsData,
    loading,
    refetch,
  } = useApi<PaginatedResponse<Project>>('/v1/projects');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projects = projectsData?.data ?? [];

  // Default to first project when selection is null or no longer valid
  const selectedProjectId =
    selectedId && projects.some((p) => p.id === selectedId)
      ? selectedId
      : (projects[0]?.id ?? null);

  const value = useMemo(
    () => ({
      projects,
      selectedProjectId,
      setSelectedProjectId: setSelectedId,
      loading,
      refetchProjects: refetch,
    }),
    [projects, selectedProjectId, loading, refetch],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
