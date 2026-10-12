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
import { SemesterManagement } from './SemesterManagement';
const app = vi.hoisted(() => ({
  api: {
    listSemesters: vi.fn(),
    semesterSupervisors: vi.fn(),
    assignSupervisors: vi.fn(),
    semesterFiles: vi.fn(),
    uploadSemesterFile: vi.fn()
  },
  refreshAdminData: vi.fn(),
  previewFile: vi.fn(),
  downloadFile: vi.fn()
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => app }));
const semester = {
  id: 's1',
  name: '2026 S1',
  year: 2026,
  start_date: '2026-01-01',
  end_date: '2026-06-30',
  deleted_at: null,
  file_count: 0,
  supervisor_count: 0
};
const page = (items: unknown[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 20
});
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  app.api.listSemesters.mockResolvedValue(page([semester]));
  app.api.semesterSupervisors.mockResolvedValue(page([]));
  app.api.semesterFiles.mockResolvedValue(page([]));
  app.refreshAdminData.mockResolvedValue(undefined);
});
it('shows source semesters and moves only the selected supervisors', async () => {
  app.api.semesterSupervisors.mockImplementation((_id, candidates) =>
    Promise.resolve(
      page(
        candidates
          ? [
              {
                id: 'u1',
                username: 'anna',
                first_name: 'Anna',
                last_name: 'Lee',
                status: 'ACTIVE',
                semester: { ...semester, id: 'old', name: '2025 S2' }
              }
            ]
          : []
      )
    )
  );
  app.api.assignSupervisors.mockResolvedValue({ moved_count: 1 });
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', {
      name: 'Manage supervisors for 2026 S1'
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add supervisors' }));
  expect(await screen.findByText('2025 S2')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select anna' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Move 1 supervisors here' })
  );
  await waitFor(() =>
    expect(app.api.assignSupervisors).toHaveBeenCalledWith('s1', ['u1'])
  );
});
it('retains failed-upload feedback and refreshes persisted file statuses', async () => {
  app.api.uploadSemesterFile.mockRejectedValue(
    new Error('Document processing failed.')
  );
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Manage files for 2026 S1' })
  );
  fireEvent.change(screen.getByLabelText('Upload semester files'), {
    target: { files: [new File(['bad'], 'notes.txt', { type: 'text/plain' })] }
  });
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'notes.txt: Document processing failed.'
  );
  await waitFor(() =>
    expect(app.api.semesterFiles.mock.calls.length).toBeGreaterThan(1)
  );
});
it('does not offer file uploads or assignments for archived semesters', async () => {
  app.api.listSemesters.mockResolvedValue(
    page([{ ...semester, deleted_at: '2026-09-18' }])
  );
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Manage files for 2026 S1' })
  );
  expect(screen.queryByLabelText('Upload semester files')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Archive 2026 S1' })).toBeNull();
});
