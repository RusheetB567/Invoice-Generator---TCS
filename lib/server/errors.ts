export class VaultError extends Error {
  constructor(message: string, public status = 400, public code?: string) { super(message); }
}
