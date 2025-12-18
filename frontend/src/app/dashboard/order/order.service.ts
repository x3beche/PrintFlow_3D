import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/app/environment';
import { OrderData, OrderEstimations } from './models';

export interface FileUploadResponse {
  success: boolean;
  file_id: string;
  preview_id: string | null;  // Preview image ID eklendi
  filename: string;
  message: string;
  file_info?: {
    volume_mm3: number;
    volume_cm3: number;
  };
}

export interface EstimationRequest {
  file_id: string;
  material: string;
  brand: string;
  order_type: string;
  infill: number;
  layer_height: number;
  quantity: number;
}

export interface EstimationResponse {
  success: boolean;
  estimated_weight: number;
  estimated_cost: number;
  cost_breakdown: {
    material_cost: number;
    brand_multiplier: number;
    layer_height_multiplier: number;
    order_type_multiplier: number;
    service_fee: number;
    quantity: number;
    unit_cost: number;
    total_cost: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.api}`;

  constructor(private http: HttpClient) { }

  uploadFile(file: File): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<FileUploadResponse>(`${this.apiUrl}/order/upload-file`, formData).pipe(
      tap(response => console.log('File Upload Response:', response))
    );
  }

  /**
   * Get preview image as Blob for display
   * @param previewId Preview image ID from upload response
   * @returns Observable<Blob> - PNG image blob
   */
  getPreviewImage(previewId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/order/preview/${previewId}`, {
      responseType: 'blob'
    }).pipe(
      tap(() => console.log('Preview Image Retrieved:', previewId))
    );
  }

  /**
   * Get preview image as Object URL for immediate display
   * @param previewId Preview image ID
   * @returns Observable<string> - Object URL for img src
   */
  getPreviewImageUrl(previewId: string): Observable<string> {
    return new Observable(observer => {
      this.getPreviewImage(previewId).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          observer.next(objectUrl);
          observer.complete();
        },
        error: (err) => observer.error(err)
      });
    });
  }

  calculateEstimation(request: EstimationRequest): Observable<EstimationResponse> {
    return this.http.post<EstimationResponse>(`${this.apiUrl}/order/calculate-estimation`, request).pipe(
      tap(response => console.log('Estimation Response:', response))
    );
  }

  createNewOrder(orderData: OrderData): Observable<any> {
    return this.http.post(`${this.apiUrl}/order/new`, orderData).pipe(
      tap(response => console.log('Order Create Response:', response))
    );
  }
}