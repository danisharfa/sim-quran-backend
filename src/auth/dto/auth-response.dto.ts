import { Role } from '../../generated/prisma/enums';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  id!: string;
  username!: string;
  role!: Role;
}
