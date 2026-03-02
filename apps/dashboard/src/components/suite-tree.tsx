import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import type { SuiteSummary } from '@/types/api';

export interface SuiteTreeNode {
  suite: SuiteSummary;
  children: SuiteTreeNode[];
}

export function buildTree(suites: SuiteSummary[]): SuiteTreeNode[] {
  const childrenMap = new Map<string | null, SuiteSummary[]>();

  for (const suite of suites) {
    const key = suite.parentSuiteId;
    const group = childrenMap.get(key);
    if (group) {
      group.push(suite);
    } else {
      childrenMap.set(key, [suite]);
    }
  }

  function buildNodes(parentId: string | null): SuiteTreeNode[] {
    const children = childrenMap.get(parentId) || [];
    return children.map((suite) => ({
      suite,
      children: buildNodes(suite.id),
    }));
  }

  return buildNodes(null);
}

interface SuiteTreeProps {
  suites: SuiteSummary[];
  selectedSuiteId: string | null;
  onSuiteSelect: (suiteId: string | null) => void;
  testCountBySuiteId: Record<string, number>;
}

const MAX_INDENT_DEPTH = 5;
const INDENT_PX = 16;

function SuiteNode({
  node,
  depth,
  selectedSuiteId,
  onSuiteSelect,
  testCountBySuiteId,
  expanded,
  onToggle,
}: {
  node: SuiteTreeNode;
  depth: number;
  selectedSuiteId: string | null;
  onSuiteSelect: (suiteId: string | null) => void;
  testCountBySuiteId: Record<string, number>;
  expanded: Record<string, boolean>;
  onToggle: (suiteId: string) => void;
}) {
  const isExpanded = expanded[node.suite.id] ?? false;
  const hasChildren = node.children.length > 0;
  const isSelected = selectedSuiteId === node.suite.id;
  const count = testCountBySuiteId[node.suite.id] ?? 0;
  const indent = Math.min(depth, MAX_INDENT_DEPTH) * INDENT_PX;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1 text-sm',
          isSelected ? 'bg-accent' : 'hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        <button
          className="shrink-0 p-0.5"
          onClick={() => hasChildren && onToggle(node.suite.id)}
          aria-label={hasChildren ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
          tabIndex={hasChildren ? 0 : -1}
          style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          className="flex min-w-0 flex-1 items-center gap-1.5"
          onClick={() => onSuiteSelect(node.suite.id)}
        >
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{node.suite.name}</span>
        </button>
        {count > 0 && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <SuiteNode
            key={child.suite.id}
            node={child}
            depth={depth + 1}
            selectedSuiteId={selectedSuiteId}
            onSuiteSelect={onSuiteSelect}
            testCountBySuiteId={testCountBySuiteId}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

export function SuiteTree({
  suites,
  selectedSuiteId,
  onSuiteSelect,
  testCountBySuiteId,
}: SuiteTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree = buildTree(suites);

  const handleToggle = (suiteId: string) => {
    setExpanded((prev) => ({ ...prev, [suiteId]: !prev[suiteId] }));
  };

  return (
    <div className="space-y-0.5">
      <button
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm',
          selectedSuiteId === null ? 'bg-accent' : 'hover:bg-accent/50',
        )}
        onClick={() => onSuiteSelect(null)}
      >
        All Suites
      </button>
      {tree.map((node) => (
        <SuiteNode
          key={node.suite.id}
          node={node}
          depth={0}
          selectedSuiteId={selectedSuiteId}
          onSuiteSelect={onSuiteSelect}
          testCountBySuiteId={testCountBySuiteId}
          expanded={expanded}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
