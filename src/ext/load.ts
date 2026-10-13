// Loads every extension (src/ext/<name>/index.ts or index.tsx) for its side effects: each one
// registers its menu rows and views with src/slots/registry.tsx. Imported once, from main.tsx.
import.meta.glob("./*/index.{ts,tsx}", { eager: true });
