import { type ZodSchema } from 'zod';

export class SchemaValidationService {
  public parse<T>(schema: ZodSchema<T>, value: unknown, message: string): T {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new Error(`${message}: ${result.error.issues.map((issue) => issue.message).join(', ')}`);
    }

    return result.data;
  }
}
