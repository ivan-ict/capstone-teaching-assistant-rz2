// @vitest-environment jsdom

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SUPPORTED_UPLOAD_ACCEPT } from '../../constants/files';
import { AttachedFile } from '../../types';
import { ChatInput } from './ChatInput';

const app = vi.hoisted(() => ({
  uploadFiles: vi.fn(),
  pendingChatAttachments: [] as AttachedFile[],
  setPendingChatAttachments: vi.fn(),
  previewFile: vi.fn(),
  libraryFiles: [] as AttachedFile[],
  projects: [],
}));

vi.mock('../../context/AppContext', () => ({ useApp: () => app }));

const uploadedFile: AttachedFile = {
  id: 'ready-file',
  name: 'diagram.png',
  size: 9,
  type: 'image/png',
  uploadedAt: '2026-08-30T00:00:00Z',
  isImage: true,
};

describe('ChatInput attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app.pendingChatAttachments = [];
  });

  it('indexes selected files before enabling Send and does not upload again on Send', async () => {
    let finishUpload: (files: AttachedFile[]) => void = () => undefined;
    app.uploadFiles.mockReturnValue(
      new Promise<AttachedFile[]>(resolve => {
        finishUpload = resolve;
      }),
    );
    const onSendMessage = vi.fn();
    const { container } = render(<ChatInput onSendMessage={onSendMessage} />);
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');

    expect(fileInput?.accept).toBe(SUPPORTED_UPLOAD_ACCEPT);
    fireEvent.change(fileInput!, { target: { files: [new File(['diagram'], 'diagram.png')] } });

    expect(app.uploadFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send message' }).disabled).toBe(true);
    expect(screen.getByText('Uploading and indexing…')).toBeTruthy();

    await act(async () => finishUpload([uploadedFile]));
    await screen.findByText('diagram.png');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(onSendMessage).toHaveBeenCalledWith('', [uploadedFile]);
    expect(app.uploadFiles).toHaveBeenCalledTimes(1);
  });

  it('removes a draft attachment locally without deleting the indexed library file', async () => {
    app.uploadFiles.mockResolvedValue([uploadedFile]);
    const { container } = render(<ChatInput onSendMessage={vi.fn()} />);
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');

    fireEvent.change(fileInput!, { target: { files: [new File(['diagram'], 'diagram.png')] } });
    await screen.findByText('diagram.png');
    fireEvent.click(screen.getByTitle('Remove attachment'));

    await waitFor(() => expect(screen.queryByText('diagram.png')).toBeNull());
    expect(app.uploadFiles).toHaveBeenCalledTimes(1);
  });
});
