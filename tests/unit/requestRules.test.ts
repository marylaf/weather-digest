import { ConflictError, ValidationError } from '../../src/errors/httpErrors.js';
import {
  assertBrigade,
  assertInProgressHasTechnicians,
  assertStatusTransition,
} from '../../src/api/services/requestRules.js';
import { REQUEST_STATUSES, type AssigneeInput } from '../../src/types/request.js';

const allowedTransitions = new Set([
  'new->in_progress',
  'new->rejected',
  'in_progress->done',
  'in_progress->rejected',
]);

function assignee(technicianId: string, role: AssigneeInput['role']): AssigneeInput {
  return { technicianId, role, hours: '1.00' };
}

describe('переходы статусов заявки', () => {
  it('разрешает только переходы из таблицы и запрещает остальные', () => {
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        const key = `${from}->${to}`;

        if (allowedTransitions.has(key)) {
          expect(() => assertStatusTransition(from, to)).not.toThrow();
          continue;
        }

        expect(() => assertStatusTransition(from, to)).toThrow(ConflictError);
      }
    }
  });

  it('для недопустимого перехода возвращает 409', () => {
    expect(() => assertStatusTransition('new', 'done')).toThrow(
      'Cannot transition status from new to done',
    );
    expect(() => assertStatusTransition('done', 'in_progress')).toThrow(ConflictError);
    expect(() => assertStatusTransition('rejected', 'new')).toThrow(ConflictError);
  });

  it('не пускает заявку в in_progress без специалистов', () => {
    expect(() => assertInProgressHasTechnicians(0)).toThrow(
      'Cannot set status to in_progress without assigned technicians',
    );
  });

  it('пускает заявку в in_progress, если специалист уже назначен', () => {
    expect(() => assertInProgressHasTechnicians(1)).not.toThrow();
  });
});

describe('правила бригады', () => {
  it('принимает бригаду с одним lead и обычными специалистами', () => {
    expect(() =>
      assertBrigade([assignee('tech-1', 'lead'), assignee('tech-2', 'member')]),
    ).not.toThrow();
  });

  it('не принимает пустую бригаду', () => {
    expect(() => assertBrigade([])).toThrow(ValidationError);
  });

  it('требует ровно одного lead', () => {
    expect(() => assertBrigade([assignee('tech-1', 'member')])).toThrow(ValidationError);
    expect(() => assertBrigade([assignee('tech-1', 'lead'), assignee('tech-2', 'lead')])).toThrow(
      ValidationError,
    );
  });

  it('не даёт назначить одного специалиста дважды', () => {
    expect(() => assertBrigade([assignee('tech-1', 'lead'), assignee('tech-1', 'member')])).toThrow(
      'Technician is already assigned to this request',
    );
  });
});
