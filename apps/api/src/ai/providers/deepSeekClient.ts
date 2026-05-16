import { buildProviderClient } from './providerUtils';

export function createDeepSeekClient(apiKey: string) {
  return buildProviderClient({
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    visionModel: 'deepseek-vl2',
    name: 'DeepSeek',
    missingKeyMessage: 'DEEPSEEK_API_KEY is not configured'
  }, apiKey);
}
