import { describe, expect, it, afterEach } from 'vitest';
import { formatAuthError, resolveAuthDomain } from './firebaseClient';

describe('firebaseClient auth helpers', () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    if (originalWindow === undefined) {
      // @ts-expect-error restore node global
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  it('uses cloakvault.buzz as authDomain when hosted on cloakvault.buzz or www.cloakvault.buzz', () => {
    // @ts-expect-error minimal browser window mock
    globalThis.window = { location: { hostname: 'cloakvault.buzz' } };
    expect(resolveAuthDomain('cloakvault-hybrid', 'cloakvault-hybrid.firebaseapp.com')).toBe(
      'cloakvault.buzz'
    );

    // @ts-expect-error minimal browser window mock
    globalThis.window = { location: { hostname: 'www.cloakvault.buzz' } };
    expect(resolveAuthDomain('cloakvault-hybrid', 'cloakvault-hybrid.firebaseapp.com')).toBe(
      'cloakvault.buzz'
    );
  });

  it('falls back to configured authDomain on localhost', () => {
    // @ts-expect-error minimal browser window mock
    globalThis.window = { location: { hostname: '127.0.0.1' } };
    expect(resolveAuthDomain('cloakvault-hybrid', 'cloakvault-hybrid.firebaseapp.com')).toBe(
      'cloakvault-hybrid.firebaseapp.com'
    );
  });

  it('formats common Firebase Auth error codes into friendly messages', () => {
    expect(formatAuthError({ code: 'auth/email-already-in-use' })).toContain('already exists');
    expect(formatAuthError({ code: 'auth/invalid-credential' })).toContain('Invalid email or password');
    expect(formatAuthError({ code: 'auth/weak-password' })).toContain('at least 6 characters');
    expect(formatAuthError({ code: 'auth/popup-closed-by-user' })).toContain('popup was closed');
  });
});
