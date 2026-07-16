/** Fix storage upload handler to use req.body when express.raw is applied. */
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export type PresignPurpose = 'proof' | 'document';

export type PresignResult = {
  uploadUrl: string;
  fileUrl: string;
  key: string;
  expiresIn: number;
};

class PresignDto {
  @IsIn(['proof', 'document'])
  purpose!: PresignPurpose;

  @IsString()
  contentType!: string;

  @IsOptional()
  @IsUUID()
  deliveryId?: string;
}

@Injectable()
export class StorageService {
  private readonly root: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    this.root =
      config.get<string>('STORAGE_LOCAL_DIR') ?? join(process.cwd(), 'uploads');
    this.publicBase = (
      config.get<string>('PUBLIC_API_URL') ??
      `http://localhost:${config.get('PORT') ?? 3001}/api/v1`
    ).replace(/\/$/, '');
  }

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  private safeKey(key: string) {
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new BadRequestException('Chave de arquivo invalida');
    }
    return key;
  }

  createKey(purpose: PresignPurpose, contentType: string): string {
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('jpeg') || contentType.includes('jpg')
        ? 'jpg'
        : contentType.includes('pdf')
          ? 'pdf'
          : 'bin';
    return `${purpose}-${randomUUID()}.${ext}`;
  }

  fileUrlForKey(key: string) {
    return `${this.publicBase}/storage/files/${key}`;
  }

  async presign(
    purpose: PresignPurpose,
    contentType: string,
  ): Promise<PresignResult> {
    await this.ensureRoot();
    const key = this.createKey(purpose, contentType);
    return {
      uploadUrl: `${this.publicBase}/storage/upload/${key}`,
      fileUrl: this.fileUrlForKey(key),
      key,
      expiresIn: 900,
    };
  }

  async putObject(key: string, body: Buffer, contentType: string) {
    await this.ensureRoot();
    const safe = this.safeKey(key);
    const full = join(this.root, safe);
    await fs.writeFile(full, body);
    await fs.writeFile(`${full}.meta`, contentType, 'utf8');
  }

  async getObject(key: string) {
    const safe = this.safeKey(key);
    const full = join(this.root, safe);
    try {
      const body = await fs.readFile(full);
      let contentType = 'application/octet-stream';
      try {
        contentType = await fs.readFile(`${full}.meta`, 'utf8');
      } catch {
        /* default */
      }
      return { body, contentType };
    } catch {
      return null;
    }
  }

  isAllowedFileUrl(url: string): boolean {
    try {
      const u = new URL(url);
      const base = new URL(this.publicBase);
      if (
        u.origin === base.origin &&
        u.pathname.startsWith(`${base.pathname}/storage/files/`)
      ) {
        return true;
      }
      const extra = (this.config.get<string>('STORAGE_ALLOWED_HOSTS') ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      return extra.includes(u.hostname);
    } catch {
      return false;
    }
  }

  assertAllowedProofUrl(url: string) {
    if (this.config.get('STORAGE_ALLOW_EXAMPLE') === 'true') {
      if (url.startsWith('https://example.com/')) return;
    }
    if (!this.isAllowedFileUrl(url)) {
      throw new BadRequestException(
        'proofUrl deve apontar para o storage da plataforma',
      );
    }
  }
}

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presign')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  presign(@Body() dto: PresignDto) {
    return this.storage.presign(dto.purpose, dto.contentType);
  }

  @Put('upload/:key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async upload(
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let body: Buffer;
    if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (typeof req.body === 'string') {
      body = Buffer.from(req.body);
    } else {
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        req.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        req.on('end', () => resolve());
        req.on('error', reject);
      });
      body = Buffer.concat(chunks);
    }
    if (!body.length) throw new BadRequestException('Corpo vazio');
    const contentType =
      (req.headers['content-type'] as string) || 'application/octet-stream';
    await this.storage.putObject(key, body, contentType);
    return res.status(201).json({
      ok: true,
      key,
      fileUrl: this.storage.fileUrlForKey(key),
    });
  }

  @Get('files/:key')
  async file(@Param('key') key: string, @Res() res: Response) {
    const obj = await this.storage.getObject(key);
    if (!obj) {
      return res.status(404).json({ message: 'Arquivo nao encontrado' });
    }
    res.setHeader('Content-Type', obj.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(obj.body);
  }
}

@Module({
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
