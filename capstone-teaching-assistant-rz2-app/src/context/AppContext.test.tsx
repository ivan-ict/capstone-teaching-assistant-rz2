// @vitest-environment jsdom
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AppProvider, useApp } from './AppContext';
const mocks = vi.hoisted(() => ({
  getAccount: vi.fn(),
  listConversations: vi.fn(),
  listConversationMessages: vi.fn(),
  listFaculties: vi.fn()
}));
vi.mock('../api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../api/client')>();
  return {
    ...original,
    ApiClient: class {
      getAccount = mocks.getAccount;
      listConversations = mocks.listConversations;
      listConversationMessages = mocks.listConversationMessages;
      listFaculties = mocks.listFaculties;
    }
  };
});
function Probe() {
  const { currentUser, conversations, setActiveConversationId } = useApp();
  return (
    <>
      <p>{currentUser?.semester?.name}</p>
      {conversations.map((c) => (
        <div key={c.id}>
          <button onClick={() => setActiveConversationId(c.id)}>
            {c.title}
          </button>
          {c.messages.map((m) => (
            <p key={m.id}>{m.content}</p>
          ))}
        </div>
      ))}
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('discards an old message response after the assignment changes on window focus', async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  });
  localStorage.setItem('cta_access_token', 'test-token');
  window.matchMedia = vi
    .fn()
    .mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
  const account = (id: string) => ({
    id: 'u1',
    username: 'test',
    role: 'SUPERVISOR',
    status: 'ACTIVE',
    created_at: '',
    profile: {
      first_name: 'Test',
      last_name: 'User',
      email: '',
      phone: '',
      faculty: { name: 'Science' },
      semester: { id, name: `Semester ${id}`, deleted_at: null }
    }
  });
  mocks.getAccount.mockResolvedValue(account('A'));
  mocks.listFaculties.mockResolvedValue([]);
  mocks.listConversations.mockResolvedValue([
    {
      id: 'c1',
      semesterId: 'A',
      title: 'Private A history',
      createdAt: '',
      updatedAt: '',
      messages: []
    }
  ]);
  let finish: (value: unknown[]) => void = () => {};
  mocks.listConversationMessages.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  render(
    <AppProvider>
      <Probe />
    </AppProvider>
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Private A history' })
  );
  await waitFor(() =>
    expect(mocks.listConversationMessages).toHaveBeenCalledWith('c1')
  );
  mocks.getAccount.mockResolvedValue(account('B'));
  mocks.listConversations.mockResolvedValue([]);
  fireEvent(window, new Event('focus'));
  await screen.findByText('Semester B');
  await act(async () =>
    finish([
      { id: 'm1', content: 'OLD PRIVATE RESPONSE', role: 'user', timestamp: '' }
    ])
  );
  expect(screen.queryByText('Private A history')).toBeNull();
  expect(screen.queryByText('OLD PRIVATE RESPONSE')).toBeNull();
});
