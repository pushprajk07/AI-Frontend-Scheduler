export interface TokenPayload {
    userId: string;
    email: string;
    iat?: number;
    exp?: number;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
