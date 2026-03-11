import { PROVIDERS as PROVIDER_DEFS } from '@/providers';

export interface Model {
  id: string;
  displayName: string;
}

interface Provider {
  displayName: string;
  providerId: string;
  models: Model[];
}

const PROVIDER_MODELS: Record<string, Model[]> = {
  openai: [
    { id: 'gpt-5.2', displayName: 'GPT 5.2' },
    { id: 'gpt-4.1', displayName: 'GPT 4.1' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', displayName: 'Sonnet 4.6' },
    { id: 'claude-opus-4-6', displayName: 'Opus 4.6' },
  ],
  google: [
    { id: 'gemini-3-flash-preview', displayName: 'Gemini 3.0 Flash' },
    { id: 'gemini-3.1-pro', displayName: 'Gemini 3.1 Pro' },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-flash-lite', displayName: 'Gemini 2.0 Flash Lite' },
  ],
  xai: [
    { id: 'grok-4-0709', displayName: 'Grok 4' },
    { id: 'grok-4-1-fast-reasoning', displayName: 'Grok 4.1 Fast Reasoning' },
  ],
  moonshot: [{ id: 'kimi-k2-5', displayName: 'Kimi K2.5' }],
  deepseek: [
    { id: 'deepseek-chat', displayName: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', displayName: 'DeepSeek R1' },
  ],
  ollama: [
    { id: 'ollama:qwen2.5:7b', displayName: 'Qwen2.5 7B (Tool Calling)' },
    { id: 'ollama:mistral:7b', displayName: 'Mistral 7B' },
    { id: 'ollama:llama3.2', displayName: 'Llama 3.2' },
    { id: 'ollama:llama3.1', displayName: 'Llama 3.1' },
    { id: 'ollama:codellama', displayName: 'Code Llama' },
  ],
};

export const PROVIDERS: Provider[] = PROVIDER_DEFS.map((provider) => ({
  displayName: provider.displayName,
  providerId: provider.id,
  models: PROVIDER_MODELS[provider.id] ?? [],
}));

export function getModelsForProvider(providerId: string): Model[] {
  const provider = PROVIDERS.find((entry) => entry.providerId === providerId);
  return provider?.models ?? [];
}

export function getModelIdsForProvider(providerId: string): string[] {
  return getModelsForProvider(providerId).map((model) => model.id);
}

export function getDefaultModelForProvider(providerId: string): string | undefined {
  const models = getModelsForProvider(providerId);
  return models[0]?.id;
}

export function getModelDisplayName(modelId: string): string {
  const normalizedId = modelId.replace(/^(ollama|openrouter):/, '');

  for (const provider of PROVIDERS) {
    const model = provider.models.find((entry) => entry.id === normalizedId || entry.id === modelId);
    if (model) {
      return model.displayName;
    }
  }

  return normalizedId;
}
