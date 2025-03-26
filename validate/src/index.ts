import { ValidationError } from 'onbbu-core';
import { z, ZodSchema } from 'zod';

export function or(schema: z.ZodObject<any>, fields: string[]) {

	return schema.refine(data => fields.some(field => data[field] !== undefined), {
		message: `You must provide at least one of: ${fields.join(', ')}`,
	});
};

export function validSchema<T, Payload>(schema: ZodSchema<T>, payload: Payload): Payload {

	const parsed: z.SafeParseReturnType<T, T> = schema.safeParse(payload);

	if (!parsed.success) {

		const message: string = parsed.error.errors
			.map(v => `${v.path.join('.')} ${v.message}`)
			.join("\n");

		throw new ValidationError(message);
	}

	return parsed.data as unknown as Payload
}

export default z