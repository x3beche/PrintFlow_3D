import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

@Component({
  selector: 'app-order-list',
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.css'
})
export class OrderListComponent {
  sidebarCollapsed = false;
  private subscription?: Subscription;

  constructor(
    private sidebarService: SidebarStateService,
  ) {
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
}
