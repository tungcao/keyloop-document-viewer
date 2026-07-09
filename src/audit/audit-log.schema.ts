import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AuditLogDocument = HydratedDocument<SearchAuditLog>;

@Schema({ timestamps: true })
export class SearchAuditLog {
  @Prop({ required: true })
  vin!: string;

  @Prop({ required: true })
  correlationId!: string;

  @Prop({
    type: { sales: String, service: String },
    required: true,
  })
  sourceStatus!: { sales: string; service: string };

  @Prop({ required: true })
  latencyMs!: number;
  // createdAt is injected by { timestamps: true }
}

export const SearchAuditLogSchema = SchemaFactory.createForClass(SearchAuditLog);
