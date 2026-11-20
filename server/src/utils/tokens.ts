
// server/src/utils/tokens.ts
import crypto from 'crypto';
import { db } from '../db';

// Хешируем токен — в БД храним только хеш
export const hashToken = (token: string): string => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Сохранить refresh-токен в БД
export const saveRefreshToken = async (
    userId: number,
    token: string
): Promise<void> => {
    const tokenHash = hashToken(token);

    // 7 дней
    const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.execute({
        sql: `
            INSERT INTO refresh_tokens
            (user_id, token_hash, expires_at)
            VALUES (?, ?, ?)
        `,
        args: [userId, tokenHash, expiresAt]
    });
};

// Интерфейс сохраненного токена
export interface StoredToken {
    id: number;
    user_id: number;
    token_hash: string;
    expires_at: string;
    revoked: number;
}

// Найти refresh-токен в БД
export const findRefreshToken = async (
    token: string
): Promise<StoredToken | undefined> => {
    const tokenHash = hashToken(token);

    const result = await db.execute({
        sql: 'SELECT * FROM refresh_tokens WHERE token_hash = ?',
        args: [tokenHash]
    });

    return result.rows[0] as unknown as StoredToken | undefined;
};

// Отозвать конкретный токен
export const revokeRefreshToken = async (
    token: string
): Promise<void> => {
    const tokenHash = hashToken(token);

    await db.execute({
        sql: 'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?',
        args: [tokenHash]
    });
};

// Отозвать все токены пользователя
export const revokeAllUserTokens = async (
    userId: number
): Promise<void> => {
    await db.execute({
        sql: 'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?',
        args: [userId]
    });
};
