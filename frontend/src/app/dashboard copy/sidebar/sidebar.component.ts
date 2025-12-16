// src/app/components/sidebar/sidebar.component.ts
import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { initFlowbite } from 'flowbite';
import { ThemeService } from 'src/app/theme-service.service';
import { SidebarStateService } from 'src/app/services/sidebar-state.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environment';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styles: [`
    .typing-animation {
      animation: typing 0.6s steps(5, end);
    }

    @keyframes typing {
      from {
        width: 0;
        overflow: hidden;
      }
      to {
        width: 100%;
        overflow: visible;
      }
    }
  `]
})
export class ChatSidebarComponent implements OnInit, OnDestroy, AfterViewInit {
  isCollapsed = false;
  isInitialLoad = true; // İlk render'da animasyonu kapatmak için
  company_logo = '';
  displayedText = 'K'; // Logo animasyonu için
  isAnimating = false; // Animasyon durumu
  private subscription?: Subscription;

  constructor(
    private themeService: ThemeService,
    private sidebarService: SidebarStateService
  ) {
    this.isCollapsed = this.sidebarService.isCollapsed;
  }

  ngOnInit(): void {
    initFlowbite();
    this.company_logo = `${environment.api}/company_logo/`;
    this.themeService.switchToDarkMode();

    // Sayfa yüklendiğinde uncollapsed ise direkt "KIWIO" göster
    if (!this.isCollapsed) {
      this.displayedText = 'KIWIO';
    }

    // Sidebar durumunu dinle
    this.subscription = this.sidebarService.collapsed$.subscribe(collapsed => {
      this.isCollapsed = collapsed;
      
      // Uncollapse edildiğinde animasyonu başlat
      if (!collapsed && !this.isInitialLoad) {
        this.animateText();
      } else if (collapsed) {
        // Collapse edildiğinde hemen "K" göster
        this.displayedText = 'K';
        this.isAnimating = false;
      }
    });
  }

  ngAfterViewInit(): void {
    // İlk paint tamamlandıktan sonra transition'ı aç
    setTimeout(() => {
      this.isInitialLoad = false;
    }, 0);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onToggle(): void {
    this.sidebarService.toggle();
  }

  /**
   * Logo yazma animasyonunu başlat
   * "K" -> "KIWIO" şeklinde harfler sırayla yazılır
   */
  private animateText(): void {
    const fullText = 'KIWIO';
    const duration = 600;
    const startTime = Date.now();
    this.isAnimating = true;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const charCount = Math.ceil(progress * fullText.length);
      const currentText = fullText.substring(0, charCount);
      
      this.displayedText = this.styleText(currentText);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };

    animate();
  }

  private styleText(text: string): string {
    return text.split('').map((char, index) => {
      const color = index < 3 ? 'text-emerald-400' : 'text-white';
      return `<span class="${color}">${char}</span>`;
    }).join('');
  }
}