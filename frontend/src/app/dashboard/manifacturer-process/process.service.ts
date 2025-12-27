import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/app/environment';

export type OrderType = 'FDM' | 'SLA' | string;

export interface OrderTimingEntry {
  user_id: string;
  timestamp: string; // backend model_dump(mode="json") -> ISO string
  status: string;
}

export interface OrderTimingTable {
  order_received?: OrderTimingEntry | null;
  assigned_to_manufacturer?: OrderTimingEntry | null;
  started_manufacturing?: OrderTimingEntry | null;
  produced?: OrderTimingEntry | null;
  ready_to_take?: OrderTimingEntry | null;
}

export interface OrderEstimations {
  estimated_weight: number;
  estimated_cost: number;
  cost_breakdown?: any;
}

// OrderFormMain raw (sanitized)
export interface OrderFormMainRaw {
  order_id: string;
  user_id: string;
  estimations: OrderEstimations;
  file_id: string;
  notes: string;
  order_type: OrderType;
  quantity: number;
  order_detail: any; // Union[FDMConfig, SLAConfig] -> istersen ayrı union type yaparız
  order_timing_table: OrderTimingTable;
  preview_id?: string | null;
  manufacturer_id: string;
  is_cancelled: boolean;

  // finalization alanları DB'de varsa order_raw içinde de olabilir
  manufacturer_notes?: string;
  delivery_address?: string;
  actual_filament_usage?: number;
  final_price?: number;
  product_file_id?: string;
}

export interface OrderDetailsResponse {
  success: boolean;

  // ✅ NEW: full raw object
  order_raw?: OrderFormMainRaw;

  order: {
    order_id: string;
    order_type: OrderType;
    is_cancelled: boolean;

    // ✅ NEW
    quantity?: number;
    preview_id?: string | null;
    manufacturer_id?: string;

    specs: {
      materialLabel: string;
      brand: string;
      colorName: string;
      colorHex: string | null;

      layerHeight: string;
      infill: string;

      buildPlate: string;

      // ✅ NEW (FDM/SLA extras)
      nozzleSize?: string; // e.g. "0.4 mm" or "N/A"
      resinType?: string;  // SLA
      uvCuring?: string;   // SLA
    };

    file: {
      name: string;
      size: string;
      fileId: string;
    };

    customer: {
      fullName: string;
      initials: string;
      userId: string;
      notes: string;
      orderHistory: string;
      // email?: string; (backend'e eklediysen)
    };

    orderInfo: {
      date: string;
      estimatedWeight: number;
      estimatedCost: number;
    };

    steps: Array<{
      id: number;
      label: string;
      date: string;
      completed: boolean;
    }>;

    finalization?: {
      notesToCustomer: string;
      deliveryAddress: string;
      filamentUsage: number;
      finalPrice: number;
    };
  };

  // opsiyonel: backend üstte de finalization gönderdiyse
  finalization?: {
    notesToCustomer: string;
    deliveryAddress: string;
    filamentUsage: number;
    finalPrice: number;
  };
}

export interface FinalizeOrderData {
  notes_to_customer: string;
  delivery_address: string;
  filament_usage: number;
  final_price: number;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerProcessService {
  private apiUrl = `${environment.api}`;

  constructor(private http: HttpClient) {}

  getOrderDetails(orderId: string): Observable<OrderDetailsResponse> {
    return this.http
      .get<OrderDetailsResponse>(`${this.apiUrl}/manufacturer/order/${orderId}`)
      .pipe(tap((response) => console.log('📋 Order Details Response:', response)));
  }

  startProduction(orderId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(
        `${this.apiUrl}/manufacturer/order/${orderId}/start_production`,
        {}
      )
      .pipe(tap((response) => console.log('▶️ Production Started:', response)));
  }

  completeProduction(orderId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(
        `${this.apiUrl}/manufacturer/order/${orderId}/complete_production`,
        {}
      )
      .pipe(tap((response) => console.log('✅ Production Completed:', response)));
  }

  /**
   * Upload product image
   * Backend returns: { success: true, file_id: string, gridfs_id: string }
   */
  uploadProductImage(
    orderId: string,
    imageFile: File
  ): Observable<{ success: boolean; file_id: string; gridfs_id?: string }> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.http
      .post<{ success: boolean; file_id: string; gridfs_id?: string }>(
        `${this.apiUrl}/manufacturer/order/${orderId}/upload_image`,
        formData
      )
      .pipe(tap((response) => console.log('📸 Image Uploaded:', response)));
  }

  finalizeOrder(orderId: string, data: FinalizeOrderData): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(
        `${this.apiUrl}/manufacturer/order/${orderId}/finalize`,
        data
      )
      .pipe(tap((response) => console.log('🏁 Order Finalized:', response)));
  }

  downloadOrderFile(orderId: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/manufacturer/order/${orderId}/download_file`, {
        responseType: 'blob',
        withCredentials: true,
      })
      .pipe(tap(() => console.log('📥 Downloading file...')));
  }

  getProductImage(orderId: string): Observable<Blob> {
    return this.http
      .get(`${this.apiUrl}/manufacturer/product_image/${orderId}`, {
        responseType: 'blob',
        withCredentials: true,
      })
      .pipe(tap(() => console.log('🖼️ Fetching product image...')));
  }
}
