import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { LoginRequestDto } from './dto/login-request.dto';
import { RefreshResponseDto } from './dto/refresh-response.dto';
import { ValidatedUserDto } from './dto/validated-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RefreshToken } from '../generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(input: LoginRequestDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
      },
    });

    if (!user) return null;

    const passwordMatch = await compare(input.password, user.password);

    if (!passwordMatch) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  async login(user: ValidatedUserDto) {
    const tokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.getOrThrow('JWT_SECRET'),
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    const refreshTokenHash = await hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { revoked: false },
    });

    for (const token of tokens) {
      const match = await compare(refreshToken, token.tokenHash);

      if (match) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revoked: true },
        });

        return;
      }
    }
  }

  async refresh(refreshToken: string): Promise<RefreshResponseDto> {
    const refreshSecret = this.configService.getOrThrow('JWT_REFRESH_SECRET');
    const accessSecret = this.configService.getOrThrow('JWT_SECRET');

    let payload: JwtPayload;

    // 1. Verify refresh token signature
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Fetch valid refresh tokens for this user
    const candidateTokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (candidateTokens.length === 0) {
      throw new UnauthorizedException('Refresh token invalid or revoked');
    }

    // 3. Find matching token
    let matchedToken: RefreshToken | null = null;

    for (const token of candidateTokens) {
      if (await compare(refreshToken, token.tokenHash)) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      throw new UnauthorizedException('Refresh token invalid');
    }

    const jwtPayload = {
      sub: payload.sub,
      username: payload.username,
      role: payload.role,
    };

    // 4. Generate new tokens
    const newAccessToken = await this.jwtService.signAsync(jwtPayload, {
      secret: accessSecret,
      expiresIn: '15m',
    });

    const newRefreshToken = await this.jwtService.signAsync(jwtPayload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    const newRefreshTokenHash = await hash(newRefreshToken, 10);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 5. Rotate refresh token
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: matchedToken.id },
        data: { revoked: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: payload.sub,
          tokenHash: newRefreshTokenHash,
          expiresAt,
        },
      }),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
