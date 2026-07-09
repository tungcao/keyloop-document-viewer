import { UnifiedDocument } from 'src/documents/interfaces/unified-document.interface';

export const NOT_FOUND_VIN = '00000000000000000';

export function fakeSalesDocs(vin: string): UnifiedDocument[] {
  return [
    {
      id: `sales-${vin}-1`,
      title: `Sales Order #SO-${vin.slice(-4)}`,
      type: 'sales_order',
      sourceSystem: 'sales',
      createdAt: new Date().toISOString(),
    },
    {
      id: `sales-${vin}-2`,
      title: `Finance Agreement #FA-${vin.slice(-4)}`,
      type: 'finance_agreement',
      sourceSystem: 'sales',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function fakeServiceDocs(vin: string): UnifiedDocument[] {
  return [
    {
      id: `service-${vin}-1`,
      title: `Workshop Job Card #WJC-${vin.slice(-4)}`,
      type: 'job_card',
      sourceSystem: 'service',
      createdAt: new Date().toISOString(),
    },
    {
      id: `service-${vin}-2`,
      title: `Warranty Claim #WC-${vin.slice(-4)}`,
      type: 'warranty_claim',
      sourceSystem: 'service',
      createdAt: new Date().toISOString(),
    },
  ];
}
