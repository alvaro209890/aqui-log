import { FirebaseConfigService } from './firebase.scaffold';

describe('FirebaseConfigService scaffold', () => {
  it('is disabled by default', () => {
    const config = {
      get: (key: string) => ({ FIREBASE_ENABLED: 'false' })[key],
    };
    const svc = new FirebaseConfigService(config as never);
    expect(svc.get().enabled).toBe(false);
    expect(svc.isReady()).toBe(false);
  });

  it('requires full credentials when enabled', () => {
    const config = {
      get: (key: string) =>
        ({
          FIREBASE_ENABLED: 'true',
          FIREBASE_PROJECT_ID: 'demo',
        })[key],
    };
    const svc = new FirebaseConfigService(config as never);
    expect(svc.get().enabled).toBe(true);
    expect(svc.isReady()).toBe(false);
  });
});
