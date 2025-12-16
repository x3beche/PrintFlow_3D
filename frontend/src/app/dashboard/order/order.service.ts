import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/app/environment';
import { OrderData } from './models';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.api}`;

  constructor(private http: HttpClient) { }

  createNewOrder(orderData: OrderData): Observable<any> {
    return this.http.post(`${this.apiUrl}/order/new`, orderData).pipe(
      tap(response => console.log('Order Create Response:', response))
    );
  }
}