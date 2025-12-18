import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environment';

export interface OrderListItem {
    order_id: string;
    order_number: string;
    preview_id: string;
    status: string;
    current_step: number;
    manufacturer: string;
    is_cancelled: boolean;
}

export interface OrderTimingEntry {
    user_id: string;
    timestamp: string;
    status: string;
}

export interface OrderTimingTable {
    order_received: OrderTimingEntry | null;
    assigned_to_manufacturer: OrderTimingEntry | null;
    started_manufacturing: OrderTimingEntry | null;
    produced: OrderTimingEntry | null;
    ready_to_take: OrderTimingEntry | null;
}

export interface OrderDetail {
    order_id: string;
    order_number: string;
    order_timing_table: OrderTimingTable;
    current_step: number;
    is_cancelled: boolean;
}

export interface CancelOrderResponse {
    success: boolean;
    message: string;
    order_id: string;
}

@Injectable({
    providedIn: 'root'
})
export class OrderListService {
    private apiUrl = environment.api;

    constructor(private http: HttpClient) { }

    getOrders(): Observable<OrderListItem[]> {
        return this.http.get<OrderListItem[]>(`${this.apiUrl}/order/list`);
    }

    getOrderDetail(orderId: string): Observable<OrderDetail> {
        return this.http.get<OrderDetail>(`${this.apiUrl}/order/detail/${orderId}`);
    }

    cancelOrder(orderId: string): Observable<CancelOrderResponse> {
        return this.http.post<CancelOrderResponse>(`${this.apiUrl}/order/cancel/${orderId}`, {});
    }
}