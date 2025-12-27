import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { OrderService } from '../../order/order.service';
import { PoolListingsService, OrderDetailsResponse, OrderDetails } from '../pool-listings.service';
import { Subscription } from 'rxjs';
import { OrderIdShortPipe } from '../order-id-short.pipe';

// ✅ EXPORT EDİLDİ - Parent component kullanabilir
export interface AdoptedTaskState {
  id: number;
  orderId: string;
  name: string;
  date: Date | string;
  image: string;
  currentStatus?: string; // Optional: "Assigned", "Manufacturing", etc.
}

@Component({
  selector: 'app-adopted-task',
  standalone: true,
  imports: [CommonModule, OrderIdShortPipe],
  templateUrl: './adopted-task.component.html',
  styleUrl: './adopted-task.component.css'
})
export class AdoptedTaskComponent implements OnInit, OnDestroy {
  @Input() imageSource: string = '';
  @Input() orderId: string = '';
  @Input() assignedDate: string | Date = new Date();
  @Input() name: string = '';
  @Input() previewId: string = '';
  @Input() currentStatus: string = 'Assigned to Manufacturer';

  // ✅ Image loading state
  displayImageUrl: string | SafeUrl = '';
  isImageLoading: boolean = true;
  imageLoadError: boolean = false;
  defaultImageUrl = 'assets/images/default-preview.png';

  // ✅ Details modal state
  isDetailsModalOpen: boolean = false;
  isLoadingDetails: boolean = false;
  orderDetails: OrderDetails | null = null;
  customerName: string = '';

  private imageSubscription?: Subscription;
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

  /**
   * Get status badge color
   */
  getStatusBadgeClass(): string {
    switch (this.currentStatus) {
      case 'Assigned to Manufacturer':
        return 'bg-yellow-400/20 text-yellow-400';
      case 'Started Manufacturing':
        return 'bg-blue-500/20 text-blue-400';
      case 'Produced':
        return 'bg-purple-500/20 text-purple-400';
      case 'Ready to Take':
        return 'bg-green-500/20 text-green-400';
      default:
        return 'bg-neutral-500/20 text-neutral-400';
    }
  }

  /**
   * Handle continue button click
   */
  onContinue(): void {
    window.location.href = `/manufacturer/process/${this.orderId}`;
  }


}
