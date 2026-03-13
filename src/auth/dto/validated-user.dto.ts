import { Role } from '../../generated/prisma/enums';

export class ValidatedUserDto {
  id!: string;
  username!: string;
  role!: Role;
}
