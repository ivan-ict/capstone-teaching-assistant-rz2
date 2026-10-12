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
import { ChatInput } from './ChatInput';
const app = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  isGeneratingResponse: false,
  currentUser: { semester: { deleted_at: null as string | null } }
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => app }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  app.currentUser.semester.deleted_at = null;
  app.sendMessage.mockResolvedValue(true);
});
it('sends text without exposing any supervisor upload or attachment controls', async () => {
  const { container } = render(<ChatInput />);
  expect(container.querySelector('input[type="file"]')).toBeNull();
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Explain the rubric' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() =>
    expect(app.sendMessage).toHaveBeenCalledWith('Explain the rubric')
  );
  await waitFor(() =>
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  );
});
it('prevents new messages when the assigned semester is archived', () => {
  app.currentUser.semester.deleted_at = '2026-09-18';
  render(<ChatInput />);
  expect(screen.getByRole<HTMLTextAreaElement>('textbox').disabled).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>('button', { name: 'Send message' })
      .disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(app.sendMessage).not.toHaveBeenCalled();
});
it('keeps the draft when the server rejects sending', async () => {
  app.sendMessage.mockResolvedValue(false);
  render(<ChatInput />);
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'Keep my draft' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  await waitFor(() => expect(app.sendMessage).toHaveBeenCalled());
  expect(screen.getByRole<HTMLTextAreaElement>('textbox').value).toBe(
    'Keep my draft'
  );
});
