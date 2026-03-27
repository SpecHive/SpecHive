import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useProject } from '@/contexts/project-context';

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  showProjectSelector?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  showProjectSelector = true,
}: PageHeaderProps) {
  const { projects, selectedProjectIds, setSelectedProjectIds, isAllSelected } = useProject();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  function getButtonLabel() {
    if (isAllSelected || selectedProjectIds.length === projects.length) {
      return 'All Projects';
    }
    if (selectedProjectIds.length === 1) {
      return projects.find((p) => p.id === selectedProjectIds[0])?.name ?? '1 project';
    }
    return `${selectedProjectIds.length} projects`;
  }

  function handleSelectAll() {
    // Context treats empty array as "all selected"
    setSelectedProjectIds([]);
  }

  function handleToggleProject(id: string) {
    if (selectedProjectIds.includes(id)) {
      // Prevent deselecting last project — fall back to all
      const next = selectedProjectIds.filter((pid) => pid !== id);
      setSelectedProjectIds(next.length === 0 ? [] : next);
    } else {
      const next = [...selectedProjectIds, id];
      // If all are now checked, normalise to empty (= all)
      setSelectedProjectIds(next.length === projects.length ? [] : next);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {showProjectSelector && projects.length > 0 && (
          <div ref={containerRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm"
              aria-haspopup="listbox"
              aria-expanded={open}
            >
              {getButtonLabel()}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </button>

            {open && (
              <div className="absolute right-0 z-50 mt-1 min-w-[180px] rounded-md border bg-background shadow-md">
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="font-medium">Select All</span>
                </label>

                <div className="my-1 border-t" />

                {projects.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(p.id)}
                      onChange={() => handleToggleProject(p.id)}
                      className="h-4 w-4"
                    />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}
