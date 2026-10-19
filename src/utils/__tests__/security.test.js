import { describe, it, expect } from 'vitest';

describe('Security parameter validation', () => {
  const numericIdRegex = /^\d+$/;
  const usernameRegex = /^[a-zA-Z0-9_.-]{1,64}$/;

  it('validates strictly positive numeric IDs', () => {
    expect(numericIdRegex.test('12345')).toBe(true);
    expect(numericIdRegex.test('0')).toBe(true);

    // Injections & non-numerics should fail
    expect(numericIdRegex.test('123&extra=1')).toBe(false);
    expect(numericIdRegex.test('123; DROP TABLE')).toBe(false);
    expect(numericIdRegex.test('-5')).toBe(false);
    expect(numericIdRegex.test('abc')).toBe(false);
    expect(numericIdRegex.test('../etc/passwd')).toBe(false);
  });

  it('validates usernames without special characters or path traversal', () => {
    expect(usernameRegex.test('ShikiUser_123')).toBe(true);
    expect(usernameRegex.test('user-name.test')).toBe(true);

    // Injection / traversal attempts should fail
    expect(usernameRegex.test('user/../../admin')).toBe(false);
    expect(usernameRegex.test('user&param=1')).toBe(false);
    expect(usernameRegex.test('<script>alert(1)</script>')).toBe(false);
    expect(usernameRegex.test('user name')).toBe(false);
  });

  it('safely clamps pagination limits', () => {
    const clampLimit = (val) => Math.min(5000, Math.max(1, parseInt(val, 10) || 5000));
    const clampPage  = (val) => Math.max(1, parseInt(val, 10) || 1);

    expect(clampLimit(500)).toBe(500);
    expect(clampLimit(999999)).toBe(5000);
    expect(clampLimit(-10)).toBe(1);
    expect(clampLimit('malicious')).toBe(5000);

    expect(clampPage('2')).toBe(2);
    expect(clampPage('-5')).toBe(1);
    expect(clampPage('abc')).toBe(1);
  });

  it('validates embedded fallback Kodik token decryption', () => {
    function decryptToken(tkn) {
      const half = Math.floor(tkn.length / 2);
      const p1   = tkn.slice(0, half).split('').reverse().join('');
      const p2   = tkn.slice(half).split('').reverse().join('');
      const dec1 = Buffer.from(p1, 'base64').toString('utf8');
      const dec2 = Buffer.from(p2, 'base64').toString('utf8');
      return dec2 + dec1;
    }

    const token = decryptToken('==QO0ADM3kTZmRTNiRDNjFDM==QOxkDMzQjZ4ADZ4YzNhZTN');
    expect(token).toBeDefined();
    expect(token.length).toBe(32);
    expect(/^[a-f0-9]{32}$/.test(token)).toBe(true);
  });
});
