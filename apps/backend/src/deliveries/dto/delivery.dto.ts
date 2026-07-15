import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { DeliveryStatus } from '../../database/enums';

export class CreateDeliveryDto {
  @IsString()
  pickupAddress!: string;

  @IsString()
  deliveryAddress!: string;

  @IsString()
  recipientName!: string;

  @IsPhoneNumber('BR')
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;
}

export class UpdateDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;

  @IsOptional()
  @IsUrl()
  proofUrl?: string;
}

export class AssignCourierDto {
  @IsString()
  courierId!: string;
}
