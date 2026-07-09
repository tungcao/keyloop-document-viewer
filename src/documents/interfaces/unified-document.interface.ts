export interface UnifiedDocument {
  id: string;
  title: string;
  type: string;
  sourceSystem: 'sales' | 'service';
  createdAt: string; // ISO 8601
}
