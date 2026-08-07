import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { DeliveryStatus } from '../../database/enums';

export const PRODUCT_TYPES = [
  'DOCUMENT',
  'FOOD',
  'ELECTRONICS',
  'FRAGILE',
  'CLOTHING',
  'MEDICINE',
  'OTHER',
] as const;

export const PACKAGE_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const DELIVERY_SCOPES = ['SAME_CITY', 'OTHER_CITY'] as const;

export class CreateDeliveryDto {
  @IsString()
  pickupAddress!: string;

  @IsLatitude()
  pickupLatitude!: number;

  @IsLongitude()
  pickupLongitude!: number;

  @IsString()
  deliveryAddress!: string;

  @IsLatitude()
  deliveryLatitude!: number;

  @IsLongitude()
  deliveryLongitude!: number;

  @IsString()
  recipientName!: string;

  @IsPhoneNumber('BR')
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsIn([...PRODUCT_TYPES])
  productType?: (typeof PRODUCT_TYPES)[number];

  @IsOptional()
  @IsIn([...PACKAGE_SIZES])
  packageSize?: (typeof PACKAGE_SIZES)[number];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(1000)
  weightKg?: number;

  @IsOptional()
  @IsIn([...DELIVERY_SCOPES])
  deliveryScope?: (typeof DELIVERY_SCOPES)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUrl({ require_tld: false }, { each: true })
  productPhotoUrls?: string[];

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  courierFeeCents?: number;
}

export class UpdateDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  status!: DeliveryStatus;

  @IsOptional()
  @IsString()
  proofUrl?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AssignCourierDto {
  @IsString()
  courierId!: string;
}

export class RateDeliveryDto {
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
