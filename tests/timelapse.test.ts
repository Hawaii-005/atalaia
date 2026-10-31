import {
  lerTimelapse,
  lerTimelapseExperimental,
  guardarTimelapseExperimental,
  guardarTimelapse,
} from '../src/utils/timelapse';

const store: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => store[key] ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store[key] = value;
  }),
}));

describe('Time-lapse Flag Experimental', () => {
  beforeEach(() => {
    for (const key in store) delete store[key];
  });

  it('desligado por omissão quando experimental não está ativo', async () => {
    await guardarTimelapseExperimental(false);
    await guardarTimelapse('p1', true);
    expect(await lerTimelapseExperimental()).toBe(false);
    expect(await lerTimelapse('p1')).toBe(false);
  });

  it('permite ativar quando a flag experimental está ligada', async () => {
    await guardarTimelapseExperimental(true);
    await guardarTimelapse('p1', true);
    expect(await lerTimelapseExperimental()).toBe(true);
    expect(await lerTimelapse('p1')).toBe(true);
  });
});
