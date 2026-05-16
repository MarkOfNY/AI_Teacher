import { buildProviderClient } from './providerUtils';

export function createOpenAiClient(apiKey: string) {
  return buildProviderClient({
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    visionModel: 'gpt-4o-mini',
    name: 'OpenAI',
    missingKeyMessage: 'OPENAI_API_KEY is not configured'
  }, apiKey);
}
