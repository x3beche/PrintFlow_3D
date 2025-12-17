import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

interface Order {
  orderNumber: string;
  status: string;
  manufacturer: string;
}

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrls: ['./order-list.component.css']
})
export class OrderListComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  // Mock data for orders
  orders: Order[] = Array.from({ length: 15 }, (_, i) => ({
    orderNumber: `#${Math.floor(Math.random() * 10000000)}`,
    status: i % 3 === 0 ? 'In Queue' : i % 3 === 1 ? 'Printing' : 'Done',
    manufacturer: 'TTO Office'
  }));

  currentPage: number = 1;
  itemsPerPage: number = 5;
  totalPages: number = Math.ceil(this.orders.length / this.itemsPerPage);

  constructor(private sidebarService: SidebarStateService) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  // Pagination methods
  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }
}