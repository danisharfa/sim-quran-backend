import { Role } from './../../generated/prisma/enums';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';

type AuthInput = { username: string; password: string };
type LoginData = { id: string; username: string; role: Role };
type AuthResult = {
  accessToken: string;
  refreshToken: string;
  id: string;
  username: string;
  role: Role;
};
type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(input: AuthInput): Promise<LoginData | null> {
    const user = await this.usersService.findUserByUsername(input.username);

    if (user && (await compare(input.password, user.password))) {
      return {
        id: user.id,
        username: user.username,
        role: user.role,
      };
    }
    return null;
  }

  async login(user: LoginData): Promise<AuthResult> {
    const tokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    // Create short-lived access token (15 min)
    const accessToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn: '15m',
    });

    // Create long-lived refresh token (7 days)
    const refreshToken = await this.jwtService.signAsync(tokenPayload, {
      expiresIn: '7d',
    });

    // Store hash of refresh token in DB
    const refreshTokenHash = await hash(refreshToken, 10);
    await this.usersService.storeRefreshToken(
      user.id,
      refreshTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    );

    return {
      accessToken,
      refreshToken,
      id: user.id,
      username: user.username,
      role: user.role,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    try {
      // Verify refresh token signature
      const payload = await this.jwtService.verifyAsync(refreshToken);

      // Check if token is stored and not revoked in DB
      const storedToken = await this.usersService.findValidRefreshToken(
        payload.sub,
        refreshToken,
      );

      if (!storedToken) {
        throw new UnauthorizedException('Refresh token invalid or revoked');
      }

      // Issue new access token
      const newAccessToken = await this.jwtService.signAsync(
        { sub: payload.sub, username: payload.username, role: payload.role },
        { expiresIn: '15m' },
      );

      // Optionally rotate refresh token (create new, revoke old)
      const newRefreshToken = await this.jwtService.signAsync(
        { sub: payload.sub, username: payload.username, role: payload.role },
        { expiresIn: '7d' },
      );

      const newRefreshTokenHash = await hash(newRefreshToken, 10);
      await this.usersService.rotateRefreshToken(
        payload.sub,
        storedToken.id,
        newRefreshTokenHash,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    // Revoke all refresh tokens for this user
    await this.usersService.revokeAllRefreshTokens(userId);
  }
}
