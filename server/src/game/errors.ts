import type { ErrorCode } from '@thegang/shared';

export class GameError extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GameError';
    this.code = code;
  }
}
