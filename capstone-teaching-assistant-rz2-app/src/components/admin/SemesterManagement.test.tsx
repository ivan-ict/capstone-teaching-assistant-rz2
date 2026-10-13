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
it('shows per-file progress and refreshes the list after each upload', async () => {
  app.api.uploadSemesterFile.mockImplementation((_id: string, file: File) =>
    file.name === 'bad.txt'
      ? Promise.reject(new Error('Uploaded files must contain extractable text.'))
      : Promise.resolve({})
  );
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Manage files for 2026 S1' })
  );
  await waitFor(() => expect(app.api.semesterFiles).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Upload semester files'), {
    target: {
      files: [
        new File(['ok'], 'good.md', { type: 'text/markdown' }),
        new File([''], 'bad.txt', { type: 'text/plain' })
      ]
    }
  });
  expect(await screen.findByText('Done: 1 uploaded, 1 failed')).toBeTruthy();
  expect(
    screen.getAllByText('Uploaded files must contain extractable text.').length
  ).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  await waitFor(() =>
    expect(app.api.semesterFiles.mock.calls.length).toBeGreaterThanOrEqual(2)
  );
});
it('uploads documents before images', async () => {
  app.api.uploadSemesterFile.mockResolvedValue({});
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Manage files for 2026 S1' })
  );
  fireEvent.change(screen.getByLabelText('Upload semester files'), {
    target: {
      files: [
        new File(['a'], 'a.png', { type: 'image/png' }),
        new File(['b'], 'b.pdf', { type: 'application/pdf' }),
        new File(['c'], 'c.jpg', { type: 'image/jpeg' }),
        new File(['d'], 'd.md', { type: 'text/markdown' })
      ]
    }
  });
  await waitFor(() =>
    expect(app.api.uploadSemesterFile).toHaveBeenCalledTimes(4)
  );
  expect(
    app.api.uploadSemesterFile.mock.calls.map(([, file]) => file.name)
  ).toEqual(['b.pdf', 'd.md', 'a.png', 'c.jpg']);
});
it('formats the semester period like other dates', async () => {
  render(<SemesterManagement />);
  expect(await screen.findByText('Jan 1, 2026 – Jun 30, 2026')).toBeTruthy();
});
it('sorts semesters on the server when a column header is clicked', async () => {
  render(<SemesterManagement />);
  fireEvent.click(await screen.findByRole('button', { name: 'Semester' }));
  await waitFor(() =>
    expect(app.api.listSemesters).toHaveBeenLastCalledWith(false, '', 1, {
      by: 'name',
      order: 'asc'
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Semester' }));
  await waitFor(() =>
    expect(app.api.listSemesters).toHaveBeenLastCalledWith(false, '', 1, {
      by: 'name',
      order: 'desc'
    })
  );
});
it('keeps the file table visible and refreshes counts while uploading', async () => {
  app.api.semesterFiles.mockResolvedValue(
    page([
      {
        id: 'f0',
        name: 'existing.pdf',
        type: 'application/pdf',
        size: 10,
        processingStatus: 'READY',
        uploadedAt: '2026-01-02T00:00:00Z'
      }
    ])
  );
  let release: () => void = () => {};
  app.api.uploadSemesterFile.mockImplementation(
    () => new Promise((resolve) => (release = () => resolve({})))
  );
  render(<SemesterManagement />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Manage files for 2026 S1' })
  );
  expect(await screen.findByText('existing.pdf')).toBeTruthy();
  const semesterCalls = app.api.listSemesters.mock.calls.length;
  fireEvent.change(screen.getByLabelText('Upload semester files'), {
    target: {
      files: [
        new File(['a'], 'a.md', { type: 'text/markdown' }),
        new File(['b'], 'b.md', { type: 'text/markdown' })
      ]
    }
  });
  await waitFor(() => expect(app.api.uploadSemesterFile).toHaveBeenCalledTimes(1));
  release();
  await waitFor(() => expect(app.api.uploadSemesterFile).toHaveBeenCalledTimes(2));
  // The semester list (and its file counts) refreshed after the first file, before the batch ended.
  expect(app.api.listSemesters.mock.calls.length).toBeGreaterThan(semesterCalls);
  expect(app.refreshAdminData).not.toHaveBeenCalled();
  expect(screen.queryByText('Loading files…')).toBeNull();
  expect(screen.getByText('existing.pdf')).toBeTruthy();
  release();
  await waitFor(() => expect(app.refreshAdminData).toHaveBeenCalledTimes(1));
});
