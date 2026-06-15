import {describe, expect, it} from 'vitest';
import {createLayoutModeSlice} from '../src/state/slices/layoutMode';

describe('layoutMode slice', () => {
  it('defaults to advanced mode', () => {
    const state = createLayoutModeSlice(
      () => {},
      () => ({}) as never,
      {} as never,
    );
    expect(state.isAdvancedMode).toBe(true);
  });

  it('toggleAdvancedMode flips the flag', () => {
    let current = createLayoutModeSlice(
      partial => {
        current = {...current, ...(typeof partial === 'function' ? partial(current as never) : partial)};
      },
      () => current as never,
      {} as never,
    );
    current.toggleAdvancedMode();
    expect(current.isAdvancedMode).toBe(false);
    current.toggleAdvancedMode();
    expect(current.isAdvancedMode).toBe(true);
  });
});
