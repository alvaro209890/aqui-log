import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import type { Repository } from 'typeorm';
import { AppModule } from '../app.module';
import { User } from '../database/entities/user.entity';
import { AccountStatus, UserRole } from '../database/enums';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const config = app.get(ConfigService);
  const users = app.get<Repository<User>>(getRepositoryToken(User));
  const email = (
    config.get<string>('ADMIN_EMAIL') ?? 'admin@aquilog.com.br'
  ).toLowerCase();

  if (!(await users.findOneBy({ email }))) {
    await users.save(
      users.create({
        name: config.get<string>('ADMIN_NAME') ?? 'Administrador Aqui Log',
        email,
        passwordHash: await hash(
          config.get<string>('ADMIN_PASSWORD') ?? 'TroqueEstaSenha123!',
          12,
        ),
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        companyId: null,
      }),
    );
  }

  await app.close();
}

void seed();
