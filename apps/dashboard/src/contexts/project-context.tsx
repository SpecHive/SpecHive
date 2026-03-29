import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useApi } from '@/shared/hooks/use-api';
import type { PaginatedResponse, Project } from '@/types/api';

interface ProjectContextValue {
  projects: Project[];
  selectedProjectIds: string[];
  setSelectedProjectIds: (ids: string[]) => void;
  isAllSelected: boolean;
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
  // Empty array means "all selected" — no explicit selection made yet
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const projects = projectsData?.data ?? [];

  const isAllSelected = selectedIds.length === 0 || selectedIds.length === projects.length;

  const selectedProjectIds = useMemo(() => {
    if (selectedIds.length === 0) {
      return projects.map((p) => p.id);
    }
    const valid = selectedIds.filter((id) => projects.some((p) => p.id === id));
    return valid.length > 0 ? valid : projects.map((p) => p.id);
  }, [selectedIds, projects]);

  const value = useMemo(
    () => ({
      projects,
      selectedProjectIds,
      setSelectedProjectIds: setSelectedIds,
      isAllSelected,
      loading,
      refetchProjects: refetch,
    }),
    [projects, selectedProjectIds, isAllSelected, loading, refetch],
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
