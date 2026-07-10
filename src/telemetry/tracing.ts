import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  SimpleSpanProcessor,
  InMemorySpanExporter,
  SpanProcessor,
  SpanExporter,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SpanStatusCode } from '@opentelemetry/api';

/**
 * Minimal one-line-per-span console exporter. The default ConsoleSpanExporter
 * dumps the full raw span object (verbose, hard to read alongside Pino logs
 * during a demo). This keeps the same information, formatted compactly.
 */
class CompactConsoleExporter implements SpanExporter {
  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    for (const span of spans) {
      const durationMs = span.duration[0] * 1000 + span.duration[1] / 1e6;
      let statusLabel = 'UNSET';
      if (span.status.code === SpanStatusCode.ERROR) {
        statusLabel = 'ERROR';
      } else if (span.status.code === SpanStatusCode.OK) {
        statusLabel = 'OK';
      }
      const attrs = Object.entries(span.attributes)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(' ');

      console.log(
        `[trace] ${span.name} duration=${durationMs.toFixed(1)}ms status=${statusLabel} traceId=${span
          .spanContext()
          .traceId.slice(0, 8)}${attrs ? ' ' + attrs : ''}`,
      );
    }
    resultCallback({ code: ExportResultCode.SUCCESS });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

// Only active when NODE_ENV=test (Jest sets this by default) — production/dev
// keeps only the compact console exporter.
export const memoryExporter = new InMemorySpanExporter();

const spanProcessors: SpanProcessor[] = [
  new SimpleSpanProcessor(new CompactConsoleExporter()),
];

if (process.env.NODE_ENV === 'test') {
  spanProcessors.push(new SimpleSpanProcessor(memoryExporter));
}

export const provider = new NodeTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'unified-document-viewer',
  }),
  spanProcessors, // must be passed at construction in SDK v2 — no addSpanProcessor() after
});

provider.register();

export const tracer = provider.getTracer('unified-document-viewer');
