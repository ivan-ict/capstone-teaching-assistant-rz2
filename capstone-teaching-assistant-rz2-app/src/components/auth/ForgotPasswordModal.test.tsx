// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ForgotPasswordModal } from './ForgotPasswordModal';

const app = vi.hoisted(() => ({
  requestPasswordReset: vi.fn()
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => app }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

it('requires a username or email before submitting', () => {
  render(<ForgotPasswordModal onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send new password' }));
  expect(app.requestPasswordReset).not.toHaveBeenCalled();
  expect(screen.getByText('Please enter your username or email.')).toBeTruthy();
});

it('submits the identifier and shows the generic confirmation', async () => {
  app.requestPasswordReset.mockResolvedValue({ success: true, message: 'If an account matches, a new password has been sent.' });
  render(<ForgotPasswordModal initialIdentifier="anna" onClose={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Username or email'), { target: { value: 'anna@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send new password' }));
  await waitFor(() => expect(screen.getByText('If an account matches, a new password has been sent.')).toBeTruthy());
  expect(app.requestPasswordReset).toHaveBeenCalledWith('anna@example.com');
  expect(screen.queryByRole('button', { name: 'Send new password' })).toBeNull();
});

it('shows request errors', async () => {
  app.requestPasswordReset.mockResolvedValue({ success: false, message: 'Network error' });
  render(<ForgotPasswordModal initialIdentifier="anna" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send new password' }));
  await waitFor(() => expect(screen.getByText('Network error')).toBeTruthy());
});

it('shows an error and no confirmation when the account does not exist', async () => {
  app.requestPasswordReset.mockResolvedValue({ success: false, message: 'No account matches that username or email.' });
  render(<ForgotPasswordModal initialIdentifier="ghost" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send new password' }));
  await waitFor(() => expect(screen.getByText('No account matches that username or email.')).toBeTruthy());
  expect(screen.queryByText(/has been sent/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Send new password' })).toBeTruthy();
});
