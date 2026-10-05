import { ConflictError, ValidationError } from '../../errors/httpErrors.js';
import type { AssigneeInput, RequestStatus } from '../../types/request.js';

const STATUS_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  new: ['in_progress', 'rejected'],
  in_progress: ['done', 'rejected'],
  done: [],
  rejected: [],
};

export function assertStatusTransition(from: RequestStatus, to: RequestStatus): void {
  if (!STATUS_TRANSITIONS[from].includes(to)) {
    throw new ConflictError(`Cannot transition status from ${from} to ${to}`);
  }
}

export function assertInProgressHasTechnicians(assigneeCount: number): void {
  if (assigneeCount === 0) {
    throw new ConflictError('Cannot set status to in_progress without assigned technicians');
  }
}

export function assertBrigade(assignees: readonly AssigneeInput[]): void {
  const details: { field: string; message: string }[] = [];
  const leadCount = assignees.filter((assignee) => assignee.role === 'lead').length;

  if (assignees.length === 0) {
    details.push({ field: 'assignees', message: 'Нужен хотя бы один специалист' });
  }

  if (leadCount !== 1) {
    details.push({
      field: 'assignees',
      message: 'В бригаде должен быть ровно один специалист с ролью lead',
    });
  }

  const technicianIds = assignees.map((assignee) => assignee.technicianId);

  if (new Set(technicianIds).size !== technicianIds.length) {
    throw new ConflictError('Technician is already assigned to this request');
  }

  if (details.length > 0) {
    throw new ValidationError(details);
  }
}
