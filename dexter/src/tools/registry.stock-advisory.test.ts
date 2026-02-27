import { describe, expect, test } from 'bun:test';
import { getToolRegistry } from './registry.js';

describe('tool registry stock_advisory integration', () => {
  test('registers stock_advisory for default hosted models', () => {
    const tools = getToolRegistry('gpt-5.2');
    const names = tools.map((tool) => tool.name);
    expect(names).toContain('stock_advisory');
  });

  test('registers stock_advisory for ollama models', () => {
    const tools = getToolRegistry('ollama:qwen2.5:7b');
    const names = tools.map((tool) => tool.name);
    expect(names).toContain('stock_advisory');
  });
});

