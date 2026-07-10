import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  SimpleSpanProcessor,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';

// Only active when NODE_ENV=test (Jest sets this by default) — production/dev
// keeps only the console exporter.
export const memoryExporter = new InMemorySpanExporter();

const spanProcessors: SpanProcessor[] = [
  new SimpleSpanProcessor(new ConsoleSpanExporter()),
];

if (process.env.NODE_ENV === 'test') {
  spanProcessors.push(new SimpleSpanProcessor(memoryExporter));
}

export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'unified-document-viewer',
  }),
  spanProcessors, // must be passed at construction in SDK v2
});

provider.register();

export const tracer = provider.getTracer('unified-document-viewer');
