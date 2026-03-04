import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, RefreshToken } from '../../generated/prisma/client';
import { Role } from '../../generated/prisma/enums';
import { hash, compare } from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async getUsers(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  async createUser(
    username: string,
    password: string,
    role?: Role,
  ): Promise<User> {
    const hashedPassword = await hash(password, 10);

    return this.prisma.user.create({
      data: { username, password: hashedPassword, role },
    });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async storeRefreshToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findValidRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<RefreshToken> {
    // Get all non-revoked tokens for this user
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() }, // Not expired
      },
    });

    // Find which token matches the provided refresh token
    for (const token of storedTokens) {
      const matches = await compare(refreshToken, token.tokenHash);
      if (matches) {
        return token;
      }
    }

    throw new Error('Invalid refresh token');
  }

  async rotateRefreshToken(
    userId: string,
    oldTokenId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: oldTokenId },
      data: { revoked: true },
    });

    // Create new token
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: newTokenHash,
        expiresAt,
      },
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }
}
