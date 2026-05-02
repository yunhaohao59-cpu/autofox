function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T> | Record<string, unknown>): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = (override as Record<string, unknown>)[key];

    if (isObject(baseVal) && isObject(overrideVal)) {
      result[key] = deepMerge(baseVal, overrideVal);
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal;
    }
  }

  return result as T;
}
