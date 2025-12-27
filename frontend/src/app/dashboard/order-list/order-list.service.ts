import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environment';

// ==================== LIST INTERFACES ====================
export interface OrderListItem {
    order_id: string;
    order_number: string;
    preview_id: string;
    status: string;
    current_step: number;
    manufacturer: string;
    is_cancelled: boolean;
}

// ==================== DETAIL INTERFACES ====================
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

export interface Estimations {
    estimated_weight: number;
    estimated_cost: number;
}

export interface OrderSpecs {
    material: string;
    brand: string;
    color: string;
    layer_height: number;
    infill: number;
}

export interface ManufacturerInfo {
    manufacturer_id: string | null;
    company: string | null;
    name: string | null;
    phone: string | null;
}

export interface FinalizationData {
    actual_filament_usage: number | null;
    final_price: number | null;
    delivery_address: string | null;
    manufacturer_notes: string | null;
    product_image_uploaded_at: string | null;
}

export interface FileInfo {
    file_id: string | null;
    preview_id: string | null;
    product_file_id: string | null;
}

export interface StepInfo {
    id: number;
    key: string;
    label: string;
    status: string; // "completed", "current", "pending", "cancelled"
    timestamp: string | null;
    completed: boolean;
}

export interface OrderDetail {
    // Basic Info
    order_id: string;
    order_number: string;
    order_type: string;
    notes: string | null;
    
    // Status
    current_step: number;
    total_steps: number;
    status_label: string;
    is_cancelled: boolean;
    is_completed: boolean;
    
    // Data
    estimations: Estimations;
    specs: OrderSpecs;
    manufacturer: ManufacturerInfo;
    finalization: FinalizationData | null;
    files: FileInfo;
    
    // Timing
    order_timing_table: OrderTimingTable;
    steps: StepInfo[];
    
    // Timestamps
    created_at: string | null;
    last_updated: string | null;
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

    /**
     * Get product image for a completed order
     */
    getProductImage(orderId: string): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/order/product-image/${orderId}`, {
            responseType: 'blob'
        });
    }
}
