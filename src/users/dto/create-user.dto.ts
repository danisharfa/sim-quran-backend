import {
  IsString,
  MinLength,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'username must be at least 3 characters' })
  readonly username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  readonly password!: string;

  @IsOptional()
  @IsEnum(Role)
  readonly role!: Role;
}
