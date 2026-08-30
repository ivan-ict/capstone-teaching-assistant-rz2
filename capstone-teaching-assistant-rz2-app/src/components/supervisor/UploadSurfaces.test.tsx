// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_UPLOAD_ACCEPT } from '../../constants/files';
import { LibraryView } from './LibraryView';
import { ProjectSettingsModal } from './ProjectSettingsModal';

const app = vi.hoisted(() => ({
  libraryFiles: [],
  projects: [],
  projectToEdit: null as null | { id: string; name: string; createdAt: string; updatedAt: string },
  uploadFiles: vi.fn(),
  deleteFile: vi.fn(),
  deleteFilesBulk: vi.fn(),
  startConversationWithFiles: vi.fn(),
  setActiveSupervisorView: vi.fn(),
  previewFile: vi.fn(),
  downloadFile: vi.fn(),
  setProjectToEdit: vi.fn(),
  updateProject: vi.fn(),
  removeFileFromProject: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({ useApp: () => app }));

describe('upload surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.projectToEdit = null;
  });

  it('keeps global library uploads uncategorised and restricts the file picker', () => {
    const { container } = render(<LibraryView />);

    fireEvent.click(screen.getByRole('button', { name: /upload files & images/i }));

    expect(screen.queryByText('Destination Project')).toBeNull();
    expect(screen.getByText('Supports TXT, MD, PDF, DOCX, JPG, PNG, and WebP.')).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>('input[type="file"]')?.accept).toBe(
      SUPPORTED_UPLOAD_ACCEPT,
    );
  });

  it('does not offer direct upload from Project Settings', () => {
    app.projectToEdit = {
      id: 'project-1',
      name: 'Capstone project',
      createdAt: '2026-08-30T00:00:00Z',
      updatedAt: '2026-08-30T00:00:00Z',
    };
    const { container } = render(<ProjectSettingsModal />);

    fireEvent.click(screen.getByRole('button', { name: /attached files & images/i }));

    expect(screen.queryByText('Upload File')).toBeNull();
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });
});
