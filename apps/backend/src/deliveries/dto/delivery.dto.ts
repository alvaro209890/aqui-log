import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
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

/**
 * `@IsNotEmpty` considera `'   '` preenchido. Sem aparar antes de validar, um
 * endereço só de espaços passaria pela obrigatoriedade do `B2C-05`.
 */
const TrimmedString = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateDeliveryDto {
  // B2C-05 / DEC-01: endereço em branco não é endereço. `@IsString` sozinho
  // aceita `''`, então a obrigatoriedade real vem do `@IsNotEmpty`.
  @TrimmedString()
  @IsString({ message: 'Informe o endereço de coleta' })
  @IsNotEmpty({ message: 'Informe o endereço de coleta' })
  @MaxLength(500, { message: 'O endereço de coleta é longo demais' })
  pickupAddress!: string;

  @IsLatitude()
  pickupLatitude!: number;

  @IsLongitude()
  pickupLongitude!: number;

  @TrimmedString()
  @IsString({ message: 'Informe o endereço de entrega' })
  @IsNotEmpty({ message: 'Informe o endereço de entrega' })
  @MaxLength(500, { message: 'O endereço de entrega é longo demais' })
  deliveryAddress!: string;

  @IsLatitude()
  deliveryLatitude!: number;

  @IsLongitude()
  deliveryLongitude!: number;

  @TrimmedString()
  @IsString({ message: 'Informe quem recebe a encomenda' })
  @IsNotEmpty({ message: 'Informe quem recebe a encomenda' })
  @MaxLength(200, { message: 'O nome de quem recebe é longo demais' })
  recipientName!: string;

  @IsPhoneNumber('BR')
  recipientPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  // B2C-05 / DEC-01: tipo, tamanho, peso e ao menos uma foto são obrigatórios
  // na CRIAÇÃO. Pedidos legados que não têm esses campos continuam legíveis;
  // a obrigatoriedade vale só para o que entra a partir de agora.
  @IsIn([...PRODUCT_TYPES], {
    message: 'Informe o tipo da encomenda',
  })
  productType!: (typeof PRODUCT_TYPES)[number];

  @IsIn([...PACKAGE_SIZES], {
    message: 'Informe o tamanho da encomenda (SMALL, MEDIUM ou LARGE)',
  })
  packageSize!: (typeof PACKAGE_SIZES)[number];

  @IsNumber(
    { maxDecimalPlaces: 3 },
    { message: 'Informe o peso da encomenda em kg' },
  )
  @Min(0.001, { message: 'O peso deve ser maior que zero' })
  @Max(1000, { message: 'O peso não pode passar de 1000 kg' })
  weightKg!: number;

  @IsOptional()
  @IsIn([...DELIVERY_SCOPES])
  deliveryScope?: (typeof DELIVERY_SCOPES)[number];

  @IsArray({ message: 'Envie ao menos uma foto da encomenda' })
  @ArrayMinSize(1, {
    message: 'Envie ao menos uma foto da encomenda',
  })
  @ArrayMaxSize(3, { message: 'Envie no máximo 3 fotos da encomenda' })
  @ArrayUnique({ message: 'Não repita a mesma foto da encomenda' })
  @IsUrl(
    { require_tld: false },
    { each: true, message: 'Cada foto deve ser uma URL válida do storage' },
  )
  productPhotoUrls!: string[];

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

  // PICK-01 / DEC-24: informado pelo prestador na coleta. O formato exato é
  // conferido no service, junto com o contador de tentativas — recusar aqui,
  // no DTO, não contaria a tentativa errada.
  @IsOptional()
  @IsString()
  @MaxLength(8)
  pickupCode?: string;
}

/**
 * PICK-01 / DEC-24: fallback de código perdido ou ilegível. Só admin/suporte,
 * sempre com motivo escrito, e com prova alternativa quando existir.
 */
export class PickupCodeOverrideDto {
  @TrimmedString()
  @IsString({ message: 'Descreva o motivo da liberação' })
  @IsNotEmpty({ message: 'Descreva o motivo da liberação' })
  @MinLength(10, {
    message: 'O motivo precisa ter ao menos 10 caracteres',
  })
  @MaxLength(500, { message: 'O motivo é longo demais' })
  reason!: string;

  @IsOptional()
  @IsString()
  alternativeProofUrl?: string;
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
