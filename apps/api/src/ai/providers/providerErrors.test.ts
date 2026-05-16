import { describe, expect, it } from 'vitest';
import { AiProviderError, throwProviderError } from './providerErrors';

describe('throwProviderError', () => {
  it('includes the provider error message and code', async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: 'Insufficient Balance',
        code: 'invalid_request_error'
      }
    }), { status: 402, statusText: 'Payment Required' });

    await expect(throwProviderError('DeepSeek', response)).rejects.toMatchObject({
      provider: 'DeepSeek',
      status: 402,
      providerMessage: 'Insufficient Balance code: invalid_request_error'
    } satisfies Partial<AiProviderError>);
  });
});
