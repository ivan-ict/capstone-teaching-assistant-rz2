// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AddSupervisorModal } from './AddSupervisorModal';
const app = vi.hoisted(() => ({
  faculties: [{ id: 'f1', name: 'Science' }],
  supervisors: [],
  semesters: [] as { id: string; name: string }[],
  addSupervisor: vi.fn(),
  setActiveAdminView: vi.fn()
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => app }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  app.semesters = [];
  app.addSupervisor.mockResolvedValue({ success: true });
});
it('blocks creation until an active semester exists and links to semester management', () => {
  const close = vi.fn();
  render(<AddSupervisorModal isOpen onClose={close} />);
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Save Supervisor' })
      .disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Manage semesters' }));
  expect(app.setActiveAdminView).toHaveBeenCalledWith('semesters');
  expect(close).toHaveBeenCalled();
});
it('requires an explicit semester selection and submits its ID', async () => {
  app.semesters = [{ id: 's1', name: '2026 Semester 1' }];
  const { container } = render(<AddSupervisorModal isOpen onClose={vi.fn()} />);
  for (const [id, value] of Object.entries({
    username: 'anna',
    firstname: 'Anna',
    lastname: 'Lee',
    email: 'anna@example.com'
  })) {
    fireEvent.change(container.querySelector(`#add-supervisor-${id}`)!, {
      target: { value }
    });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Save Supervisor' }));
  expect(app.addSupervisor).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Semester *'), {
    target: { value: 's1' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save Supervisor' }));
  await waitFor(() =>
    expect(app.addSupervisor).toHaveBeenCalledWith(
      expect.objectContaining({ semesterId: 's1' })
    )
  );
  expect(app.addSupervisor.mock.calls[0][0]).not.toHaveProperty('password');
});
it('does not ask the admin for a password', () => {
  const { container } = render(<AddSupervisorModal isOpen onClose={vi.fn()} />);
  expect(container.querySelector('input[type="password"]')).toBeNull();
  expect(screen.getByText(/emailed to the\s+supervisor/)).toBeTruthy();
});
