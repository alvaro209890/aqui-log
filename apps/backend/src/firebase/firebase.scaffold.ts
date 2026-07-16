/**
 * Firebase scaffold — DISABLED by default.
 * Do not import into AppModule until FIREBASE_ENABLED=true and adapters are real.
 */
import { Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FirebaseRuntimeConfig = {
  enabled: boolean;
  projectId: string | null;
  storageBucket: string | null;
  clientEmail: string | null;
  /** Private key PEM; may contain escaped \\n from env. */
  privateKey: string | null;
};

@Injectable()
export class FirebaseConfigService {
  private readonly logger = new Logger(FirebaseConfigService.name);

  constructor(private readonly config: ConfigService) {}

  get(): FirebaseRuntimeConfig {
    const enabled = this.config.get('FIREBASE_ENABLED') === 'true';
    return {
      enabled,
      projectId: this.config.get<string>('FIREBASE_PROJECT_ID') ?? null,
      storageBucket: this.config.get<string>('FIREBASE_STORAGE_BUCKET') ?? null,
      clientEmail: this.config.get<string>('FIREBASE_CLIENT_EMAIL') ?? null,
      privateKey: this.config.get<string>('FIREBASE_PRIVATE_KEY') ?? null,
    };
  }

  /** Returns false and logs once if partially configured. */
  isReady(): boolean {
    const c = this.get();
    if (!c.enabled) return false;
    const complete = Boolean(
      c.projectId && c.clientEmail && c.privateKey && c.storageBucket,
    );
    if (!complete) {
      this.logger.warn(
        'FIREBASE_ENABLED=true but credentials incomplete — adapters stay inactive',
      );
    }
    return complete;
  }
}

/**
 * Stub: future Firebase Storage implementation.
 * Contract should match local StorageService.presign / put / public URL policy.
 */
@Injectable()
export class FirebaseStorageAdapterStub {
  private readonly logger = new Logger(FirebaseStorageAdapterStub.name);

  constructor(private readonly firebaseConfig: FirebaseConfigService) {}

  assertReady() {
    if (!this.firebaseConfig.isReady()) {
      throw new Error(
        'Firebase Storage adapter not configured (scaffold only). Use STORAGE_DRIVER=local.',
      );
    }
  }

  presign(): never {
    this.assertReady();
    this.logger.error('FirebaseStorageAdapterStub.presign not implemented');
    throw new Error('Firebase Storage not implemented — scaffold only');
  }
}

/**
 * Stub: send FCM using tokens from device_tokens table.
 */
@Injectable()
export class FcmPushAdapterStub {
  private readonly logger = new Logger(FcmPushAdapterStub.name);

  constructor(private readonly firebaseConfig: FirebaseConfigService) {}

  sendToToken(
    token: string,
    title: string,
    body: string,
  ): { sent: false; reason: 'firebase_disabled' } {
    void token;
    void title;
    void body;
    if (!this.firebaseConfig.isReady()) {
      this.logger.debug('FCM skipped (Firebase not ready)');
      return { sent: false, reason: 'firebase_disabled' };
    }
    this.logger.error('FcmPushAdapterStub.sendToToken not implemented');
    throw new Error('FCM not implemented — scaffold only');
  }
}

@Module({
  providers: [
    FirebaseConfigService,
    FirebaseStorageAdapterStub,
    FcmPushAdapterStub,
  ],
  exports: [
    FirebaseConfigService,
    FirebaseStorageAdapterStub,
    FcmPushAdapterStub,
  ],
})
export class FirebaseScaffoldModule {}
