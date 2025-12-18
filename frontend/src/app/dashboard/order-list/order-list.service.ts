import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/app/environment';

// Interfaces matching backend Pydantic models
export interface OrderEstimations {
    estimated_weight: number;
    estimated_cost: number;
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

export interface PrintingConfig {
    material: string;
    brand: string;
    color: string;
    layer_height: number;
    infill: number;
}

export interface FDMConfig extends PrintingConfig {
    bottom_texture: string;
    nozzle_size: number;
}

export interface SLAConfig extends PrintingConfig {
    resin_type: string;
    uv_curing: string;
}

export interface OrderFormMain {
    order_id: string;
    user_id: string;
    estimations: OrderEstimations;
    file_id: string;
    notes: string;
    order_type: string;
    order_detail: FDMConfig | SLAConfig;
    order_timing_table: OrderTimingTable;
    preview_id: string;
}

@Injectable({
    providedIn: 'root'
})
export class OrderListService {
    private apiUrl = environment.api;

    constructor(private http: HttpClient) { }

    /**
     * Get all orders for the current user
     */
    getOrders(): Observable<OrderFormMain[]> {
        return this.http.get<OrderFormMain[]>(`${this.apiUrl}/order/list`);
    }

    /**
     * Get current status from order timing table
     */
    getCurrentStatus(timingTable: OrderTimingTable): number {
        if (timingTable.ready_to_take) return 5;
        if (timingTable.produced) return 4;
        if (timingTable.started_manufacturing) return 3;
        if (timingTable.assigned_to_manufacturer) return 2;
        if (timingTable.order_received) return 1;
        return 1; // Default
    }

    /**
     * Get status text from step number
     */
    getStatusText(step: number): string {
        switch (step) {
            case 1: return 'Order Received';
            case 2: return 'Assigned to Manufacturer';
            case 3: return 'Started Manufacturing';
            case 4: return 'Produced';
            case 5: return 'Ready to Take';
            default: return 'Unknown Status';
        }
    }
}