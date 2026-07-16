import { Injectable, Logger } from '@nestjs/common';

/** Local-only mail: logs messages. Swap for SMTP/Resend in production. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  sendPasswordReset(email: string, rawToken: string): Promise<void> {
    this.logger.log(
      `[password-reset] to=${email} token=${rawToken} (console-only in local)`,
    );
    return Promise.resolve();
  }
}
