import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

// Order interface - UPDATED
interface Order {
  id: string;
  orderNumber: string;
  currentStep: number; // 1-5
  manufacturer: string;
  imageUrl: string;
}

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css'
})
export class OrderListComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  // Make Math available in template
  Math = Math;

  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalItems: number = 15;
  totalPages: number = 3;

  // Mock data - 15 orders with different steps
  allOrders: Order[] = [
    { id: '1', orderNumber: '#58923751', currentStep: 1, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '2', orderNumber: '#83042917', currentStep: 2, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '3', orderNumber: '#26178594', currentStep: 3, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '4', orderNumber: '#90431658', currentStep: 4, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '5', orderNumber: '#51729846', currentStep: 5, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '6', orderNumber: '#74829361', currentStep: 1, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '7', orderNumber: '#19283746', currentStep: 3, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '8', orderNumber: '#65748392', currentStep: 3, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '9', orderNumber: '#38475869', currentStep: 4, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '10', orderNumber: '#92837465', currentStep: 5, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '11', orderNumber: '#56473829', currentStep: 1, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '12', orderNumber: '#73829461', currentStep: 2, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '13', orderNumber: '#48392756', currentStep: 3, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '14', orderNumber: '#29384756', currentStep: 4, manufacturer: 'TTO Office', imageUrl: '' },
    { id: '15', orderNumber: '#83746592', currentStep: 5, manufacturer: 'TTO Office', imageUrl: '' }
  ];

  // Current page orders
  displayedOrders: Order[] = [];

  constructor(
    private sidebarService: SidebarStateService,
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );
    
    this.updateDisplayedOrders();
  }

  // Update orders based on current page
  updateDisplayedOrders(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.displayedOrders = this.allOrders.slice(startIndex, endIndex);
  }

  // Get status text based on step number
  getStatusText(step: number): string {
    switch (step) {
      case 1:
        return 'Order Received';
      case 2:
        return 'Assigned to Manufacturer';
      case 3:
        return 'Started Manufacturing';
      case 4:
        return 'Produced';
      case 5:
        return 'Ready to Take';
      default:
        return 'Unknown Status';
    }
  }

  // Pagination methods
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

  // Get page numbers for pagination
  getPageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // Helper method for calculating end index
  getEndIndex(): number {
    return Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
  }

  // Helper method for calculating start index
  getStartIndex(): number {
    return (this.currentPage - 1) * this.itemsPerPage + 1;
  }

  // Order operations
  trackOrder(order: Order): void {
    console.log('Track order:', order.orderNumber);
    // TODO: Implement track order functionality
  }

  cancelOrder(order: Order): void {
    console.log('Cancel order:', order.orderNumber);
    // TODO: Implement cancel order functionality
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}