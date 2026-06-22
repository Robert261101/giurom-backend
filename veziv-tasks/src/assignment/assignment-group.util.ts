import { AssignmentMode, AssignmentStatus } from './entity/task-assignment.entity';

/** Convenție existentă: pool la nivel de locație pentru everyone_gets_it. */
export function buildLocationDepartmentGroupId(locationId: number): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 11);
  return `loc_${locationId}_${ts}_${rand}`;
}

export type LogicalGroupStatusLabel =
  | 'Nouă'
  | 'În lucru'
  | 'Finalizată'
  | 'Anulată';

const COMPLETED_LIKE = new Set<string>([
  AssignmentStatus.COMPLETED,
  AssignmentStatus.WAITING_RESPONSE,
  'completed',
  'waiting_response',
]);

const NEW_LIKE = new Set<string>([
  AssignmentStatus.ASSIGNED,
  AssignmentStatus.SCHEDULED,
  'assigned',
  'scheduled',
]);

const IN_PROGRESS_LIKE = new Set<string>([
  AssignmentStatus.IN_PROGRESS,
  'in_progress',
]);

/** Status logic afișat pentru un grup everyone_gets_it. */
export function computeLogicalGroupStatus(
  statuses: Array<string | null | undefined>,
): LogicalGroupStatusLabel {
  const normalized = statuses
    .map((s) => (s ?? '').toLowerCase().trim())
    .filter(Boolean);
  if (normalized.length === 0) {
    return 'Anulată';
  }

  const active = normalized.filter((s) => s !== AssignmentStatus.DEACTIVATED);
  if (active.length === 0) {
    return 'Anulată';
  }

  if (active.every((s) => COMPLETED_LIKE.has(s))) {
    return 'Finalizată';
  }

  if (
    active.every((s) => NEW_LIKE.has(s)) &&
    !active.some((s) => IN_PROGRESS_LIKE.has(s) || COMPLETED_LIKE.has(s))
  ) {
    return 'Nouă';
  }

  if (
    active.some(
      (s) =>
        IN_PROGRESS_LIKE.has(s) ||
        COMPLETED_LIKE.has(s) ||
        (!NEW_LIKE.has(s) &&
          s !== AssignmentStatus.DEACTIVATED &&
          s !== 'deactivated'),
    )
  ) {
    return 'În lucru';
  }

  return 'Nouă';
}

export function isEveryoneGetsItGroup(assignment: {
  department_group_id?: string | null;
  assignment_mode?: string | null;
}): boolean {
  return (
    !!assignment.department_group_id &&
    assignment.assignment_mode === AssignmentMode.EVERYONE_GETS_IT
  );
}
