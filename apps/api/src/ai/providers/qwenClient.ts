import { buildProviderClient } from './providerUtils';

export function createQwenClient(apiKey: string) {
  return buildProviderClient({
    apiUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-turbo',
    visionModel: 'qwen-vl-plus',
    name: 'Qwen',
    missingKeyMessage: 'QWEN_API_KEY is not configured'
  }, apiKey);
}
