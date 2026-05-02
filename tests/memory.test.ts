import { describe, test, expect } from "bun:test";
import { VectorStore } from "../server/memory/vector";

describe("VectorStore", () => {
  test("embed produces 256-dim vector", () => {
    const store = new VectorStore();
    const vec = store.embed("hello world");
    expect(vec.length).toBe(256);
  });

  test("similar texts have higher similarity", () => {
    const store = new VectorStore();
    const a = store.embed("read a file");
    const b = store.embed("read file content");
    const c = store.embed("execute shell command");
    const simAB = store.similarity(a, b);
    const simAC = store.similarity(a, c);
    expect(simAB).toBeGreaterThan(simAC);
  });
});
