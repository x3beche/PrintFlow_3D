import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { GraphComponent } from './graph/graph.component';
import { AdoptedTaskComponent, AdoptedTaskState } from './adopted-task/adopted-task.component';
import { NonAdoptedTaskComponent, NonAdoptedTaskState } from './non-adopted-task/non-adopted-task.component';
import { OrderSummary, AdoptedOrderSummary, PoolListingsService } from './pool-listings.service';

@Component({
  selector: 'app-manifacturer-pool',
  templateUrl: './manifacturer-pool.component.html',
  styleUrl: './manifacturer-pool.component.css'
})
export class ManifacturerPoolComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  // ✅ Continuing Tasks - API'den gelecek
  allContinuingTasks: AdoptedTaskState[] = [];

  // ✅ Summary Stats - value = percentage, count = adet
  summaryStats = [
    { value: 0, count: 0, label: 'Non-adopted tasks' },
    { value: 0, count: 0, label: 'In Progress' },
    { value: 0, count: 0, label: 'Completed' },
    { value: 0, count: 0, label: 'Cancelled' }
  ];


  // ✅ Raw counts for calculation
  private rawCounts = {
    nonAdopted: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0
  };

  // ✅ Available Tasks - API'den gelecek
  allAvailableTasks: NonAdoptedTaskState[] = [];

  // ✅ Pagination state'leri
  continuingTasksPage = 1;
  continuingTasksPerPage = 2;
  
  availableTasksPage = 1;
  availableTasksPerPage = 3;

  constructor(
    private sidebarService: SidebarStateService,
    private poolListingsService: PoolListingsService
  ) {
    this.sidebarCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    this.subscription = this.sidebarService.collapsed$.subscribe(
      collapsed => this.sidebarCollapsed = collapsed
    );

    // ✅ API'den verileri çek
    this.loadUnassignedOrders();
    this.loadAdoptedOrders();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  private calculatePercentages(): void {
    const total = this.rawCounts.nonAdopted + 
                  this.rawCounts.inProgress + 
                  this.rawCounts.completed + 
                  this.rawCounts.cancelled;
    
    if (total > 0) {
      this.summaryStats[0].value = Math.round((this.rawCounts.nonAdopted / total) * 100);
      this.summaryStats[0].count = this.rawCounts.nonAdopted;
      
      this.summaryStats[1].value = Math.round((this.rawCounts.inProgress / total) * 100);
      this.summaryStats[1].count = this.rawCounts.inProgress;
      
      this.summaryStats[2].value = Math.round((this.rawCounts.completed / total) * 100);
      this.summaryStats[2].count = this.rawCounts.completed;
      
      this.summaryStats[3].value = Math.round((this.rawCounts.cancelled / total) * 100);
      this.summaryStats[3].count = this.rawCounts.cancelled;
    } else {
      this.summaryStats.forEach(stat => {
        stat.value = 0;
        stat.count = 0;
      });
    }

    console.log('📊 Updated Summary Stats (Percentages & Counts):', this.summaryStats);
    console.log('📊 Raw Counts:', this.rawCounts);
  }


  /**
   * ✅ Load unassigned orders from API
   */
  loadUnassignedOrders(): void {
    this.poolListingsService.getUnassignedOrders().subscribe({
      next: (response) => {
        console.log('✅ Unassigned Orders Response:', response);
        
        // ✅ API verisini NonAdoptedTaskState formatına çevir
        this.allAvailableTasks = response.orders.map((order: OrderSummary, index: number) => ({
          id: index + 1,
          orderId: order.order_id,
          name: order.customer_name,
          date: order.order_received_date ? new Date(order.order_received_date) : new Date(),
          image: order.preview_id 
        }));

        console.log('📦 Transformed Available Tasks:', this.allAvailableTasks);

        // ✅ Raw count'u güncelle
        this.rawCounts.nonAdopted = response.count;
        
        // ✅ Percentage'ları yeniden hesapla
        this.calculatePercentages();
      },
      error: (err) => {
        console.error('❌ Error fetching unassigned orders:', err);
      }
    });
  }

  /**
   * ✅ Load adopted orders from API
   */
  loadAdoptedOrders(): void {
    this.poolListingsService.getAdoptedOrders().subscribe({
      next: (response) => {
        console.log('✅ Adopted Orders Response:', response);
        
        // ✅ API verisini AdoptedTaskState formatına çevir ve status'a göre ayır
        let inProgressCount = 0;
        let completedCount = 0;
        
        this.allContinuingTasks = response.orders.map((order: AdoptedOrderSummary, index: number) => {
          const status = order.current_status;
          
          // ✅ Status'a göre sayaçları güncelle
          if (status === 'Ready to Take') {
            completedCount++;
          } else if (
            status === 'Assigned to Manufacturer' || 
            status === 'Started Manufacturing' || 
            status === 'Produced'
          ) {
            inProgressCount++;
          }
          
          return {
            id: index + 1,
            orderId: order.order_id,
            name: order.customer_name,
            date: order.assigned_date ? new Date(order.assigned_date) : new Date(),
            image: order.preview_id,
            currentStatus: status
          };
        });

        console.log('📦 Transformed Adopted Tasks:', this.allContinuingTasks);
        console.log('📊 In Progress:', inProgressCount, 'Completed:', completedCount);

        // ✅ Raw counts'u güncelle
        this.rawCounts.inProgress = inProgressCount;
        this.rawCounts.completed = completedCount;
        
        // ✅ Percentage'ları yeniden hesapla
        this.calculatePercentages();
      },
      error: (err) => {
        console.error('❌ Error fetching adopted orders:', err);
      }
    });
  }

  /**
   * ✅ Handle order rejection - Remove from list
   */
  onOrderRejected(orderId: string): void {
    console.log('🗑️ Order rejected, removing from list:', orderId);
    
    // Remove from allAvailableTasks
    this.allAvailableTasks = this.allAvailableTasks.filter(task => task.orderId !== orderId);
    
    // Update raw count
    this.rawCounts.nonAdopted = this.allAvailableTasks.length;
    
    // ✅ Percentage'ları yeniden hesapla
    this.calculatePercentages();
    
    // If current page is empty after removal, go to previous page
    if (this.availableTasks.length === 0 && this.availableTasksPage > 1) {
      this.availableTasksPage--;
    }
    
    console.log('📊 Remaining tasks:', this.allAvailableTasks.length);
  }

  /**
   * ✅ Handle order adoption - Refresh both lists
   */
  onOrderAdopted(orderId: string): void {
    console.log('✅ Order adopted, refreshing lists:', orderId);
    
    // Refresh both lists
    this.loadUnassignedOrders();
    this.loadAdoptedOrders();
  }

  // ✅ Continuing Tasks Pagination
  get continuingTasks(): AdoptedTaskState[] {
    const start = (this.continuingTasksPage - 1) * this.continuingTasksPerPage;
    const end = start + this.continuingTasksPerPage;
    return this.allContinuingTasks.slice(start, end);
  }

  get continuingTasksTotalPages(): number {
    return Math.ceil(this.allContinuingTasks.length / this.continuingTasksPerPage);
  }

  getContinuingTasksPageNumbers(): number[] {
    return Array.from({ length: this.continuingTasksTotalPages }, (_, i) => i + 1);
  }

  goToContinuingTasksPage(page: number): void {
    if (page >= 1 && page <= this.continuingTasksTotalPages) {
      this.continuingTasksPage = page;
    }
  }

  previousContinuingTasksPage(): void {
    if (this.continuingTasksPage > 1) {
      this.continuingTasksPage--;
    }
  }

  nextContinuingTasksPage(): void {
    if (this.continuingTasksPage < this.continuingTasksTotalPages) {
      this.continuingTasksPage++;
    }
  }

  getContinuingTasksStartIndex(): number {
    return (this.continuingTasksPage - 1) * this.continuingTasksPerPage + 1;
  }

  getContinuingTasksEndIndex(): number {
    return Math.min(this.continuingTasksPage * this.continuingTasksPerPage, this.allContinuingTasks.length);
  }

  // ✅ Available Tasks Pagination
  get availableTasks(): NonAdoptedTaskState[] {
    const start = (this.availableTasksPage - 1) * this.availableTasksPerPage;
    const end = start + this.availableTasksPerPage;
    return this.allAvailableTasks.slice(start, end);
  }

  get availableTasksTotalPages(): number {
    return Math.ceil(this.allAvailableTasks.length / this.availableTasksPerPage);
  }

  getAvailableTasksPageNumbers(): number[] {
    return Array.from({ length: this.availableTasksTotalPages }, (_, i) => i + 1);
  }

  goToAvailableTasksPage(page: number): void {
    if (page >= 1 && page <= this.availableTasksTotalPages) {
      this.availableTasksPage = page;
    }
  }

  previousAvailableTasksPage(): void {
    if (this.availableTasksPage > 1) {
      this.availableTasksPage--;
    }
  }

  nextAvailableTasksPage(): void {
    if (this.availableTasksPage < this.availableTasksTotalPages) {
      this.availableTasksPage++;
    }
  }

  getAvailableTasksStartIndex(): number {
    return (this.availableTasksPage - 1) * this.availableTasksPerPage + 1;
  }

  getAvailableTasksEndIndex(): number {
    return Math.min(this.availableTasksPage * this.availableTasksPerPage, this.allAvailableTasks.length);
  }
}
