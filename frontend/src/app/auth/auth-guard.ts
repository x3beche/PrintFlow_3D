import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from './auth-service.service';

@Injectable({
  providedIn: 'root',
})
class PermissionsService {
  constructor(private router: Router, private authService: AuthService) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    let status = this.authService.hasToken();
    if (!status) {
      this.router.navigate(['/login']);
      return false;
    }
    console.log(status);
    // Role-based route protection
    const expectedRoles = next.data['roles'] as string[];
    if (expectedRoles) {
      const hasAccess = this.authService.hasAnyRole(expectedRoles);
      if (!hasAccess) {
        // Redirect to appropriate page based on user role
        this.redirectBasedOnRole();
        return false;
      }
    }

    return true;
  }

  private redirectBasedOnRole(): void {
    const userRole = this.authService.getUserRole();
    if (userRole === 'user') {
      this.router.navigate(['/order/new']);
    } else if (userRole === 'manufacturer') {
      this.router.navigate(['/manufacturer/order/pool']);
    } else if (userRole === 'admin') {
      this.router.navigate(['/profile/settings']);
    }else {
      this.router.navigate(['/']);
    }
  }
}

export const AuthGuard: CanActivateFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  return inject(PermissionsService).canActivate(next, state);
};

















@Injectable({
  providedIn: 'root',
})
class ReversePermissionsService {
  constructor(private router: Router, private authService: AuthService) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    let status = this.authService.hasToken();
    if (status) {
      // Redirect based on role instead of hardcoded route
      this.redirectBasedOnRole();
      return false;
    }
    return true;
  }

  private redirectBasedOnRole(): void {
    const userRole = this.authService.getUserRole();
    if (userRole === 'user') {
      this.router.navigate(['/order/new']);
    } else if (userRole === 'manufacturer') {
      this.router.navigate(['/manufacturer/order/pool']);
    } else if (userRole === 'admin') {
      this.router.navigate(['/profile/settings']);
    }else {
      this.router.navigate(['/']);
    }
  }
}

export const ReverseAuthGuard: CanActivateFn = (
  next: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): boolean => {
  return inject(ReversePermissionsService).canActivate(next, state);
};