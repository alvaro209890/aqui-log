import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import { Company } from '../database/entities/company.entity';
import { Courier } from '../database/entities/courier.entity';
import { User } from '../database/entities/user.entity';
import { AccountStatus, UserRole } from '../database/enums';
import {
  LoginDto,
  RegisterCompanyDto,
  RegisterCourierDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha invalidos');
    }
    if (user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Cadastro ainda nao aprovado');
    }
    return this.issueToken(user);
  }

  async registerCompany(dto: RegisterCompanyDto) {
    await this.ensureEmailAvailable(dto.email);
    return this.dataSource.transaction(async (manager) => {
      const company = await manager.save(
        Company,
        manager.create(Company, {
          legalName: dto.legalName,
          tradeName: dto.tradeName,
          document: dto.document.replace(/\D/g, ''),
          status: AccountStatus.PENDING,
        }),
      );
      const user = await manager.save(
        User,
        manager.create(User, {
          name: dto.ownerName,
          email: dto.email.toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          role: UserRole.COMPANY_OWNER,
          status: AccountStatus.PENDING,
          companyId: company.id,
        }),
      );
      return { id: user.id, companyId: company.id, status: user.status };
    });
  }

  async registerCourier(dto: RegisterCourierDto) {
    await this.ensureEmailAvailable(dto.email);
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.save(
        User,
        manager.create(User, {
          name: dto.name,
          email: dto.email.toLowerCase(),
          passwordHash: await hash(dto.password, 12),
          role: UserRole.COURIER,
          status: AccountStatus.PENDING,
          companyId: null,
        }),
      );
      const courier = await manager.save(
        Courier,
        manager.create(Courier, {
          userId: user.id,
          document: dto.document.replace(/\D/g, ''),
          vehicleType: dto.vehicleType,
          status: AccountStatus.PENDING,
        }),
      );
      return { id: user.id, courierId: courier.id, status: user.status };
    });
  }

  private async ensureEmailAvailable(email: string) {
    if (await this.users.findOneBy({ email: email.toLowerCase() })) {
      throw new ConflictException('E-mail ja cadastrado');
    }
  }

  private async issueToken(user: User) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });
    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }
}
