import { ValidatedUserDto } from './validated-user.dto';

export class LoginResponseDto {
  accessToken!: string;
  user!: ValidatedUserDto;
}
