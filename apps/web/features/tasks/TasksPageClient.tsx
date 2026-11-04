'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { TasksView, type TaskRow, type TeamName } from './TasksView';

export function TasksPageClient({
  initialTasks,
  teams,
  focusTaskId,
  error,
}: {
  initialTasks: TaskRow[];
  teams: TeamName[];
  focusTaskId?: string;
  error: boolean;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const router = useRouter();

  const handleComplete = async (taskId: string, version: number) => {
    const res = await fetch(`/api/operator/tasks/${taskId}/complete`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedVersion: version }),
    });

    if (!res.ok) {
      throw new Error('Failed to complete task');
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    router.refresh();
  };

  return (
    <TasksView
      tasks={tasks}
      teams={teams}
      focusTaskId={focusTaskId}
      error={error}
      onComplete={handleComplete}
    />
  );
}
