import { OrderListItem, OrderListService, OrderDetail, StepInfo } from './order-list.service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { OrderService } from '../order/order.service';

interface OrderDisplay extends OrderListItem {
  imageUrl: string | SafeUrl;
  isImageLoading: boolean;
  imageLoadError: boolean;
}

interface TrackingStep {
  number: number;
  title: string;
  date: string;
  isCompleted: boolean;
  isCurrent: boolean;
  status: string;
}

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css'
})
export class OrderListComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;
  private ordersSubscription?: Subscription;
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalItems: number = 0;
  totalPages: number = 0;

  // Orders data
  allOrders: OrderDisplay[] = [];
  displayedOrders: OrderDisplay[] = [];

  // Loading state
  isLoading: boolean = false;
  errorMessage: string = '';

  // Default placeholder image
  defaultImageUrl = 'assets/images/default-preview.png';

  // Track Modal state
  isModalOpen: boolean = false;
  selectedOrderDetail: OrderDetail | null = null;
  trackingSteps: TrackingStep[] = [];
  isLoadingDetail: boolean = false;

  // Product Image
  productImageUrl: string | SafeUrl | null = null;
  isLoadingProductImage: boolean = false;

  // Cancel Modal state
  isCancelModalOpen: boolean = false;
  orderToCancel: OrderDisplay | null = null;
  isCancelling: boolean = false;

  constructor(
    private sidebarService: SidebarStateService,
    private orderListService: OrderListService,
    private orderService: OrderService,
    private sanitizer: DomSanitizer
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    this.loadOrders();
  }

  loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.ordersSubscription = this.orderListService.getOrders().subscribe({
      next: (orders: OrderListItem[]) => {
        this.allOrders = orders.map(order => ({
          ...order,
          imageUrl: this.defaultImageUrl,
          isImageLoading: true,
          imageLoadError: false
        }));

        this.totalItems = this.allOrders.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.updateDisplayedOrders();
        this.isLoading = false;

        this.loadPreviewImages();
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.errorMessage = 'Failed to load orders. Please try again.';
        this.isLoading = false;
      }
    });
  }

  loadPreviewImages(): void {
    this.allOrders.forEach(order => {
      if (order.preview_id && order.preview_id !== 'default_preview') {
        this.orderService.getPreviewImageUrl(order.preview_id).subscribe({
          next: (url) => {
            order.imageUrl = this.sanitizer.bypassSecurityTrustUrl(url);
            order.isImageLoading = false;
            order.imageLoadError = false;
          },
          error: (error) => {
            console.error(`Error loading preview for order ${order.order_number}:`, error);
            order.imageUrl = this.defaultImageUrl;
            order.isImageLoading = false;
            order.imageLoadError = true;
          }
        });
      } else {
        order.imageUrl = this.defaultImageUrl;
        order.isImageLoading = false;
      }
    });
  }

  updateDisplayedOrders(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedOrders = this.allOrders.slice(startIndex, endIndex);
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.updateDisplayedOrders();
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateDisplayedOrders();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updateDisplayedOrders();
    }
  }

  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  getStartIndex(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  /**
   * Track order - Open modal with tracking details
   */
  trackOrder(order: OrderDisplay): void {
    this.isLoadingDetail = true;
    this.isModalOpen = true;
    this.productImageUrl = null;

    this.orderListService.getOrderDetail(order.order_id).subscribe({
      next: (detail) => {
        this.selectedOrderDetail = detail;
        this.buildTrackingSteps(detail);
        this.isLoadingDetail = false;

        // Load product image if completed
        if (detail.is_completed && detail.files.product_file_id) {
          this.loadProductImage(order.order_id);
        }
      },
      error: (error) => {
        console.error('Error loading order detail:', error);
        this.isLoadingDetail = false;
        this.closeModal();
        alert('Failed to load order details. Please try again.');
      }
    });
  }

  /**
   * Load product image for completed orders
   */
  loadProductImage(orderId: string): void {
    this.isLoadingProductImage = true;

    this.orderListService.getProductImage(orderId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.productImageUrl = this.sanitizer.bypassSecurityTrustUrl(url);
        this.isLoadingProductImage = false;
      },
      error: (error) => {
        console.warn('Could not load product image:', error);
        this.isLoadingProductImage = false;
      }
    });
  }

  /**
   * Build tracking steps from order detail - using new steps array
   */
  buildTrackingSteps(detail: OrderDetail): void {
    // Use steps from API directly
    this.trackingSteps = detail.steps.map(step => ({
      number: step.id,
      title: step.label,
      date: step.timestamp ? this.formatDate(step.timestamp) : '-',
      isCompleted: step.completed,
      isCurrent: step.status === 'current',
      status: step.status
    }));
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format full date for display
   */
  formatFullDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Close track modal
   */
  closeModal(): void {
    this.isModalOpen = false;
    this.selectedOrderDetail = null;
    this.trackingSteps = [];
    
    // Revoke product image URL
    if (this.productImageUrl && typeof this.productImageUrl === 'string' && this.productImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.productImageUrl);
    }
    this.productImageUrl = null;
  }

  /**
   * Open cancel confirmation modal
   */
  cancelOrder(order: OrderDisplay): void {
    if (order.is_cancelled) {
      alert('This order is already cancelled.');
      return;
    }

    if (order.current_step === 5) {
      alert('Cannot cancel order that is already ready to take.');
      return;
    }

    this.orderToCancel = order;
    this.isCancelModalOpen = true;
  }

  /**
   * Close cancel modal
   */
  closeCancelModal(): void {
    this.isCancelModalOpen = false;
    this.orderToCancel = null;
  }

  /**
   * Confirm cancel order
   */
  confirmCancelOrder(): void {
    if (!this.orderToCancel) return;

    this.isCancelling = true;

    this.orderListService.cancelOrder(this.orderToCancel.order_id).subscribe({
      next: (response) => {
        if (response.success) {
          const orderIndex = this.allOrders.findIndex(o => o.order_id === this.orderToCancel!.order_id);
          if (orderIndex !== -1) {
            this.allOrders[orderIndex].is_cancelled = true;
          }
          
          this.updateDisplayedOrders();
          this.closeCancelModal();
        } else {
          alert(response.message || 'Failed to cancel order');
        }
        this.isCancelling = false;
      },
      error: (error) => {
        console.error('Error cancelling order:', error);
        const errorMsg = error.error?.detail || 'Failed to cancel order. Please try again.';
        alert(errorMsg);
        this.isCancelling = false;
      }
    });
  }

  /**
   * Get status color class
   */
  getStatusColorClass(status: string): string {
    if (status === 'cancelled') return 'text-red-500';
    if (status === 'completed') return 'text-green-500';
    if (status === 'current') return 'text-yellow-400';
    return 'text-neutral-500';
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.ordersSubscription?.unsubscribe();
    
    this.allOrders.forEach(order => {
      if (typeof order.imageUrl === 'string' && order.imageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(order.imageUrl);
      }
    });

    if (this.productImageUrl && typeof this.productImageUrl === 'string' && this.productImageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.productImageUrl);
    }
  }
}
