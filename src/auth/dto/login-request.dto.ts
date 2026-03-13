import { IsString, MinLength, IsNotEmpty } from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'username must be at least 3 characters' })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'password must be at least 6 characters' })
  password!: string;
}
