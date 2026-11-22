import { Pipe, PipeTransform, inject } from '@angular/core';
import { SettingsService } from '../services/settings.service';

/** Formats an amount in the user's chosen currency. Impure so it reacts to currency changes. */
@Pipe({ name: 'money', pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly settings = inject(SettingsService);

  transform(value: number | null | undefined, compact = false): string {
    // read the signal so a currency change re-renders
    this.settings.settings();
    return this.settings.format(value ?? 0, compact);
  }
}
