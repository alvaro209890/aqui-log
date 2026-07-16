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
  const password =
    config.get<string>('ADMIN_PASSWORD') ?? 'TroqueEstaSenha123!';
  const passwordHash = await hash(password, 12);
  const name = config.get<string>('ADMIN_NAME') ?? 'Administrador Aqui Log';

  const existing = await users.findOneBy({ email });
  if (existing) {
    existing.name = name;
    existing.passwordHash = passwordHash;
    existing.role = UserRole.SUPER_ADMIN;
    existing.status = AccountStatus.ACTIVE;
    await users.save(existing);

    console.log(`Admin atualizado: ${email}`);
  } else {
    await users.save(
      users.create({
        name,
        email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        companyId: null,
      }),
    );

    console.log(`Admin criado: ${email}`);
  }

  await app.close();
}

void seed();
