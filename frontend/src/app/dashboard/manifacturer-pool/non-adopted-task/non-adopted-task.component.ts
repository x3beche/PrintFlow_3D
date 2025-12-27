import { Component, Input, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { OrderService } from '../../order/order.service';
import { PoolListingsService, OrderDetailsResponse, OrderDetails } from '../pool-listings.service';
import { Subscription } from 'rxjs';
import { OrderIdShortPipe } from '../order-id-short.pipe';

export interface NonAdoptedTaskState {
  id: number;          
  orderId: string;
  name: string;        
  date: Date | string; 
  image: string;      
}

@Component({
  selector: 'app-non-adopted-task',
  standalone: true,
  imports: [CommonModule, OrderIdShortPipe],
  templateUrl: './non-adopted-task.component.html',
  styleUrl: './non-adopted-task.component.css'
})
export class NonAdoptedTaskComponent implements OnInit, OnDestroy {
  @Input() imageSource: string = '';
  @Input() orderId: string = '';
  @Input() createdDate: string | Date = new Date();
  @Input() name: string = '';
  @Input() previewId: string = '';
  
  @Output() orderRejected = new EventEmitter<string>();
  @Output() orderAdopted = new EventEmitter<string>();

  // ✅ Image loading state
  displayImageUrl: string | SafeUrl = '';
  isImageLoading: boolean = true;
  imageLoadError: boolean = false;
  defaultImageUrl = 'assets/images/default-preview.png';

  // ✅ Reject modal state
  isRejectModalOpen: boolean = false;
  isRejecting: boolean = false;

  // ✅ Adopt modal state
  isAdoptModalOpen: boolean = false;
  isAdopting: boolean = false;

  // ✅ Details modal state
  isDetailsModalOpen: boolean = false;
  isLoadingDetails: boolean = false;
  orderDetails: OrderDetails | null = null;
  customerName: string = '';

  private imageSubscription?: Subscription;
  private rejectSubscription?: Subscription;
  private adoptSubscription?: Subscription;
  private detailsSubscription?: Subscription;

  constructor(
    private orderService: OrderService,
    private poolListingsService: PoolListingsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadPreviewImage();
  }

  ngOnDestroy(): void {
    this.imageSubscription?.unsubscribe();
    this.rejectSubscription?.unsubscribe();
    this.adoptSubscription?.unsubscribe();
    this.detailsSubscription?.unsubscribe();
    
    // ✅ Cleanup blob URL
    if (typeof this.displayImageUrl === 'string' && this.displayImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.displayImageUrl);
    }
  }

  /**
   * Load preview image from API
   */
  loadPreviewImage(): void {
    if (this.previewId && this.previewId !== 'default_preview') {
      this.isImageLoading = true;
      
      this.imageSubscription = this.orderService.getPreviewImageUrl(this.previewId).subscribe({
        next: (url) => {
          this.displayImageUrl = this.sanitizer.bypassSecurityTrustUrl(url);
          this.isImageLoading = false;
          this.imageLoadError = false;
        },
        error: (error) => {
          console.error(`Error loading preview ${this.previewId}:`, error);
          this.displayImageUrl = this.defaultImageUrl;
          this.isImageLoading = false;
          this.imageLoadError = true;
        }
      });
    } else {
      this.displayImageUrl = this.defaultImageUrl;
      this.isImageLoading = false;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // DETAILS MODAL METHODS
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Open details modal and load order details
   */
  openDetailsModal(): void {
    this.isDetailsModalOpen = true;
    this.loadOrderDetails();
  }

  /**
   * Close details modal
   */
  closeDetailsModal(): void {
    this.isDetailsModalOpen = false;
    this.orderDetails = null;
  }

  /**
   * Load complete order details from API
   */
  loadOrderDetails(): void {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 LOADING ORDER DETAILS');
    console.log('🔍 Order ID:', this.orderId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.isLoadingDetails = true;

    this.detailsSubscription = this.poolListingsService.getOrderDetails(this.orderId).subscribe({
      next: (response: OrderDetailsResponse) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ SUCCESS: Order details loaded');
        console.log('📦 Response:', response);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        this.orderDetails = response.order;
        this.customerName = response.customer_info.customer_name;
        this.isLoadingDetails = false;
      },
      error: (error) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ ERROR: Failed to load order details');
        console.error('📊 Status Code:', error.status);
        console.error('📦 Full Error:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        this.isLoadingDetails = false;
        alert('Failed to load order details. Please try again.');
      }
    });
  }

  /**
   * Get timeline entries in chronological order
   */
  getTimelineEntries(): Array<{key: string, label: string, entry: any}> {
    if (!this.orderDetails?.order_timing_table) return [];

    const timeline = [];
    const table = this.orderDetails.order_timing_table;

    if (table.order_received) {
      timeline.push({ key: 'order_received', label: 'Order Received', entry: table.order_received });
    }
    if (table.assigned_to_manufacturer) {
      timeline.push({ key: 'assigned_to_manufacturer', label: 'Assigned to Manufacturer', entry: table.assigned_to_manufacturer });
    }
    if (table.started_manufacturing) {
      timeline.push({ key: 'started_manufacturing', label: 'Started Manufacturing', entry: table.started_manufacturing });
    }
    if (table.produced) {
      timeline.push({ key: 'produced', label: 'Produced', entry: table.produced });
    }
    if (table.ready_to_take) {
      timeline.push({ key: 'ready_to_take', label: 'Ready to Take', entry: table.ready_to_take });
    }

    return timeline;
  }

  // ════════════════════════════════════════════════════════════════════════
  // REJECT ORDER METHODS
  // ════════════════════════════════════════════════════════════════════════

  openRejectModal(): void {
    this.isRejectModalOpen = true;
  }

  closeRejectModal(): void {
    if (!this.isRejecting) {
      this.isRejectModalOpen = false;
    }
  }

  confirmRejectOrder(): void {
    if (this.isRejecting) return;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ REJECT ORDER INITIATED');
    console.log('📋 Order ID:', this.orderId);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    this.isRejecting = true;

    this.rejectSubscription = this.poolListingsService.rejectOrder(this.orderId).subscribe({
      next: (response) => {
        console.log('✅ SUCCESS: Order rejected');
        this.isRejecting = false;
        this.isRejectModalOpen = false;
        this.orderRejected.emit(this.orderId);
      },
      error: (error) => {
        console.error('❌ ERROR: Failed to reject order');
        this.isRejecting = false;
        alert(error.error?.detail || 'Failed to reject order. Please try again.');
      }
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // ADOPT ORDER METHODS
  // ════════════════════════════════════════════════════════════════════════

  openAdoptModal(): void {
    this.isAdoptModalOpen = true;
  }

  closeAdoptModal(): void {
    if (!this.isAdopting) {
      this.isAdoptModalOpen = false;
    }
  }
  
  get isFdm(): boolean {
    return this.orderDetails?.order_type === 'FDM';
  }

  get isSla(): boolean {
    return this.orderDetails?.order_type === 'SLA';
  }

  get quantityLabel(): string {
    const q = this.orderDetails?.quantity;
    return (q === null || q === undefined) ? 'N/A' : String(q);
  }

  confirmAdoptOrder(): void {
    if (this.isAdopting) return;

    this.isAdopting = true;

    this.adoptSubscription = this.poolListingsService.assignOrder(this.orderId).subscribe({
      next: (response) => {
        this.isAdopting = false;
        this.isAdoptModalOpen = false;
        this.orderAdopted.emit(this.orderId);
        
        setTimeout(() => {
          window.location.reload();
        }, 500);
      },
      error: (error) => {
        this.isAdopting = false;
        
        let errorMessage = 'Failed to adopt order. Please try again.';
        
        if (error.status === 409) {
          errorMessage = 'This order has already been assigned to another manufacturer.';
        } else if (error.status === 400 && error.error?.detail?.includes('already adopted')) {
          errorMessage = 'You have already adopted this order.';
        } else if (error.error?.detail) {
          errorMessage = error.error.detail;
        }
        
        alert(errorMessage);
      }
    });
  }

}
