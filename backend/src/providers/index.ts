import { config } from '../config.js';
import { MarketPriceProvider } from './MarketPriceProvider.js';
import { MockPriceProvider } from './MockProvider.js';
import { PollingPriceProvider } from './PollingProvider.js';
import { ExnessPriceProvider } from './ExnessProvider.js';

export function createPriceProvider(): MarketPriceProvider {
  switch (config.priceProvider) {
    case 'exness':
      return new ExnessPriceProvider(config.exnessApiUrl, config.exnessApiKey, config.pricePollIntervalMs);
    case 'polling':
      return new PollingPriceProvider({
        url: config.pollingPriceUrl,
        intervalMs: config.pricePollIntervalMs,
        apiKey: config.pollingApiKey,
      });
    case 'mock':
    default:
      // Mock starts at ~3650, useful for dev; in prod use polling/exness
      return new MockPriceProvider(3650, config.pricePollIntervalMs);
  }
}

export { MarketPriceProvider, MockPriceProvider, PollingPriceProvider, ExnessPriceProvider };
