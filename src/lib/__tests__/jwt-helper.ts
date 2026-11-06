/** An unsigned JWT-shaped token carrying `exp` (seconds). */
export function fakeJwt(expSeconds: number): string {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'RS256' })}.${b64({ sub: 'u1', exp: expSeconds })}.sig`;
}

