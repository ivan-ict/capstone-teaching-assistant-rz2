// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const app = vi.hoisted(() => ({
  login: vi.fn(),
  themeMode: 'light',
  setThemeMode: vi.fn()
}));
vi.mock('../../context/AppContext', () => ({ useApp: () => app }));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  app.login.mockResolvedValue({ success: true });
});

it('sends the username in lowercase', async () => {
  const { container } = render(<LoginPage />);
  fireEvent.change(container.querySelector('#login-username-input')!, { target: { value: '  Anna ' } });
  fireEvent.change(container.querySelector('#login-password-input')!, { target: { value: 'Secret1' } });
  fireEvent.click(container.querySelector('#login-submit-btn')!);
  await waitFor(() => expect(app.login).toHaveBeenCalledWith('anna', 'Secret1'));
});

it('places forgot password after the sign-in button in tab order', () => {
  const { container } = render(<LoginPage />);
  const ids = Array.from(container.querySelectorAll('input, button'))
    .map((el) => el.id)
    .filter((id) => ['login-username-input', 'login-password-input', 'login-submit-btn', 'forgot-password-link'].includes(id));
  expect(ids).toEqual(['login-username-input', 'login-password-input', 'login-submit-btn', 'forgot-password-link']);
  expect(screen.getByText('Forgot password?')).toBeTruthy();
});
