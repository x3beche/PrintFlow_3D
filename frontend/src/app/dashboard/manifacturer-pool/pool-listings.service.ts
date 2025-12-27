import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/app/environment';

/**
 * ✅ Updated interfaces to match the NEW backend responses:
 * - unassigned_orders now includes: order_type, quantity, material, brand, color, layer_height, infill,
 *   nozzle_size, bottom_texture, resin_type, uv_curing
 * - adopted_orders summary also includes the same extra fields
 * - order_details already returns full order document; we just add `quantity`
 */

// ---------- Shared Types ----------
export type OrderType = 'FDM' | 'SLA' | string;

export interface PrintingConfig {
  material: string;
  brand: string;
  color: string;
  layer_height: number;
  infill: number;

  // FDM only
  bottom_texture?: string;
  nozzle_size?: number;

  // SLA only
  resin_type?: string;
  uv_curing?: string;
}

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

export interface CustomerInfo {
  customer_id: string;
  customer_name: string;
  customer_email: string;
}

export interface ManufacturerInfo {
  manufacturer_id: string;
  manufacturer_name: string;
  manufacturer_email: string;
}

// ---------- Unassigned Orders ----------
export interface OrderSummary {
  order_id: string;
  order_id_short: string;
  preview_id: string;
  order_received_date: string | null;
  customer_name: string;
  is_cancelled: boolean;

  // ✅ NEW
  order_type?: OrderType | null;
  quantity?: number | null;

  material?: string | null;
  brand?: string | null;
  color?: string | null;
  layer_height?: number | null;
  infill?: number | null;

  nozzle_size?: number | null;
  bottom_texture?: string | null;

  resin_type?: string | null;
  uv_curing?: string | null;
}

export interface UnassignedOrdersResponse {
  success: boolean;
  count: number;
  orders: OrderSummary[];
  timestamp: string;
}

// ---------- Reject / Assign ----------
export interface RejectOrderResponse {
  success: boolean;
  message: string;
  order_id: string;
  timestamp: string;
}

export interface AssignOrderResponse {
  success: boolean;
  message: string;
  order_id: string;
  manufacturer_id: string;
  timestamp: string;
}

// ---------- Adopted Orders ----------
export interface AdoptedOrderSummary {
  order_id: string;
  order_id_short: string;
  preview_id: string;
  assigned_date: string | null;
  customer_name: string;
  is_cancelled: boolean;
  current_status: string;

  // ✅ NEW (same as unassigned summary)
  order_type?: OrderType | null;
  quantity?: number | null;

  material?: string | null;
  brand?: string | null;
  color?: string | null;
  layer_height?: number | null;
  infill?: number | null;

  nozzle_size?: number | null;
  bottom_texture?: string | null;

  resin_type?: string | null;
  uv_curing?: string | null;
}

export interface AdoptedOrdersResponse {
  success: boolean;
  count: number;
  orders: AdoptedOrderSummary[];
  timestamp: string;
}

// ---------- Order Details ----------
export interface OrderDetails {
  order_id: string;
  user_id: string;
  manufacturer_id: string;
  preview_id: string;
  file_id: string;
  notes: string;

  order_type: OrderType;
  quantity: number; // ✅ NEW (OrderFormMain’e eklendiyse kesin gelir; eski kayıtlarda undefined olabilir)

  order_detail: PrintingConfig;
  estimations: OrderEstimations;
  order_timing_table: OrderTimingTable;
  is_cancelled: boolean;

  manufacturer_info: ManufacturerInfo | null;
  rejected_manufacturers?: string[];
  last_updated?: string;
}

export interface OrderDetailsResponse {
  success: boolean;
  order: OrderDetails;
  customer_info: CustomerInfo;
  timestamp: string;
}

// ---------- Service ----------
@Injectable({
  providedIn: 'root'
})
export class PoolListingsService {
  private apiUrl = `${environment.api}`;

  constructor(private http: HttpClient) {}

  /**
   * Get all unassigned orders available for adoption
   */
  getUnassignedOrders(): Observable<UnassignedOrdersResponse> {
    return this.http
      .get<UnassignedOrdersResponse>(`${this.apiUrl}/manufacturer/unassigned_orders/`)
      .pipe(tap(response => console.log('📦 Unassigned Orders Response:', response)));
  }

  /**
   * Reject an order - prevents it from showing in this manufacturer's list
   */
  rejectOrder(orderId: string): Observable<RejectOrderResponse> {
    return this.http
      .post<RejectOrderResponse>(`${this.apiUrl}/manufacturer/reject_order/${orderId}`, {})
      .pipe(tap(response => console.log('❌ Reject Order Response:', response)));
  }

  /**
   * Assign (adopt) an order to current manufacturer
   */
  assignOrder(orderId: string): Observable<AssignOrderResponse> {
    return this.http
      .post<AssignOrderResponse>(`${this.apiUrl}/manufacturer/assign_order/${orderId}`, {})
      .pipe(tap(response => console.log('✅ Assign Order Response:', response)));
  }

  /**
   * Get complete details of a specific order
   */
  getOrderDetails(orderId: string): Observable<OrderDetailsResponse> {
    return this.http
      .get<OrderDetailsResponse>(`${this.apiUrl}/manufacturer/order_details/${orderId}`)
      .pipe(tap(response => console.log('📋 Order Details Response:', response)));
  }

  /**
   * Get all orders adopted by current manufacturer
   */
  getAdoptedOrders(): Observable<AdoptedOrdersResponse> {
    return this.http
      .get<AdoptedOrdersResponse>(`${this.apiUrl}/manufacturer/adopted_orders/`)
      .pipe(tap(response => console.log('✅ Adopted Orders Response:', response)));
  }
}
