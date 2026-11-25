import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LiveBajusQuote, parseBajusGoldHtml } from '../utils/bajus-parser.util';

/**
 * Fetches official BAJUS gold rates from https://www.bajus.org/gold-price
 * via the configured dev proxy endpoint and parses BDT/gram & BDT/vori.
 */
@Injectable({ providedIn: 'root' })
export class BajusPriceService {
  constructor(private http: HttpClient) {}

  fetchOfficialRates(): Observable<LiveBajusQuote> {
    return this.http
      .get(environment.bajusGoldPriceUrl, { responseType: 'text' })
      .pipe(map((html) => parseBajusGoldHtml(html)));
  }
}
