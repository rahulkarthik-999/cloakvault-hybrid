import { describe, expect, it } from 'vitest';
import { isTransientProviderError } from './hybridAiService';

describe('isTransientProviderError', () => {
  it('retries Gemini capacity and rate-limit failures', () => {
    expect(
      isTransientProviderError(
        new Error(
          'AI: Error fetching from https://firebasevertexai.googleapis.com/v1beta/...:generateContent: [500 ] This model is currently experiencing high demand. (AI/fetch-error)'
        )
      )
    ).toBe(true);
    expect(isTransientProviderError(new Error('[503 Service Unavailable] overloaded'))).toBe(true);
    expect(isTransientProviderError(new Error('[429 ] Resource exhausted'))).toBe(true);
  });

  it('does not retry permanent or on-device failures', () => {
    expect(isTransientProviderError(new Error('[400 ] Invalid argument'))).toBe(false);
    expect(isTransientProviderError(new Error('[403 ] App Check token is invalid'))).toBe(false);
    expect(isTransientProviderError(new Error('On-device model is unavailable.'))).toBe(false);
  });
});
