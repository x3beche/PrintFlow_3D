import { Component } from '@angular/core';
import { Subscription } from 'rxjs';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';

@Component({
  selector: 'app-manifacturer-process',
  templateUrl: './manifacturer-process.component.html',
  styleUrl: './manifacturer-process.component.css'
})
export class ManifacturerProcessComponent {
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
