import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useValorEstavel } from "./useValorEstavel";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useValorEstavel", () => {
  it("só entrega o valor novo depois que ele parar de mudar", () => {
    const { result, rerender } = renderHook(({ v }) => useValorEstavel(v, 120), { initialProps: { v: [1] } });
    rerender({ v: [5] });
    act(() => vi.advanceTimersByTime(60));
    rerender({ v: [9] });
    act(() => vi.advanceTimersByTime(60));
    expect(result.current).toEqual([1]);
    act(() => vi.advanceTimersByTime(120));
    expect(result.current).toEqual([9]);
  });

  it("o primeiro valor vale na hora", () => {
    const { result } = renderHook(() => useValorEstavel([3], 120));
    expect(result.current).toEqual([3]);
  });
});
