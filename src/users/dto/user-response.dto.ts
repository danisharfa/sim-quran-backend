import { Role } from '../../../generated/prisma/enums';

export class UserResponseDto {
  id!: string;
  username!: string;
  role!: Role;
  createdAt!: Date;
  updatedAt!: Date;
}
