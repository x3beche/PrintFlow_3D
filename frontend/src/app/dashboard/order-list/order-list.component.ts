import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { OrderListService, OrderFormMain } from './order-list.service';

// Order interface for display
interface Order {
  id: string;
  orderNumber: string;
  currentStep: number; // 1-5
  manufacturer: string;
  imageUrl: string;
  fullData: OrderFormMain; // Keep full order data for reference
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

  // Make Math available in template
  Math = Math;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalItems: number = 0;
  totalPages: number = 0;

  // Orders data
  allOrders: Order[] = [];
  displayedOrders: Order[] = [];

  // Loading state
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(
    private sidebarService: SidebarStateService,
    private orderListService: OrderListService
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    this.loadOrders();
  }

  /**
   * Load orders from backend
   */
  loadOrders(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.ordersSubscription = this.orderListService.getOrders().subscribe({
      next: (orders: OrderFormMain[]) => {
        // Transform backend data to display format
        this.allOrders = orders.map(order => ({
          id: order.order_id,
          orderNumber: '#' + order.order_id.substring(0, 8),
          currentStep: this.orderListService.getCurrentStatus(order.order_timing_table),
          manufacturer: 'TTO Office', // Mock value as per backend
          imageUrl: order.preview_id,
          fullData: order
        }));

        this.totalItems = this.allOrders.length;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
        this.updateDisplayedOrders();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading orders:', error);
        this.errorMessage = 'Failed to load orders. Please try again.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Update orders based on current page
   */
  updateDisplayedOrders(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedOrders = this.allOrders.slice(startIndex, endIndex);
  }

  /**
   * Get status text based on step number
   */
  getStatusText(step: number): string {
    return this.orderListService.getStatusText(step);
  }

  /**
   * Pagination methods
   */
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

  /**
   * Get page numbers for pagination
   */
  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /**
   * Helper method for calculating end index
   */
  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  /**
   * Helper method for calculating start index
   */
  getStartIndex(): number {
    if (this.totalItems === 0) return 0;
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  /**
   * Order operations
   */
  trackOrder(order: Order): void {
    console.log('Track order:', order.orderNumber, order.fullData);
    // TODO: Implement track order functionality
    // You can access full order data via order.fullData
  }

  cancelOrder(order: Order): void {
    console.log('Cancel order:', order.orderNumber, order.fullData);
    // TODO: Implement cancel order functionality
    // You can access full order data via order.fullData
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.ordersSubscription?.unsubscribe();
  }
}