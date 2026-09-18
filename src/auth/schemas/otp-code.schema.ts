import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpCodeDocument = OtpCode & Document;

@Schema({ timestamps: true, strict: false, collection: 'otp_codes' })
export class OtpCode {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  consumed: boolean;

  @Prop({ default: 0 })
  attempts: number;
}

export const OtpCodeSchema = SchemaFactory.createForClass(OtpCode);
