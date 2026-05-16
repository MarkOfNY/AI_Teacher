export class AiProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    public readonly providerMessage: string
  ) {
    super(`${provider} request failed: ${status} ${providerMessage}`);
  }
}

interface ProviderErrorPayload {
  error?: {
    message?: string;
    code?: string | null;
    type?: string | null;
  };
}

function isProviderErrorPayload(value: unknown): value is ProviderErrorPayload {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export async function throwProviderError(provider: string, response: Response): Promise<never> {
  const text = await response.text().catch(() => '');
  let message = text.trim();

  if (text) {
    try {
      const payload = JSON.parse(text) as unknown;
      if (isProviderErrorPayload(payload)) {
        const providerMessage = payload.error?.message;
        const code = payload.error?.code;
        message = [providerMessage, code ? `code: ${code}` : null].filter(Boolean).join(' ');
      }
    } catch {
      message = text.trim();
    }
  }

  throw new AiProviderError(provider, response.status, message || response.statusText);
}
