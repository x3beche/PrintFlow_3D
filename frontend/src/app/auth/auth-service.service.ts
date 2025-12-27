import { EventEmitter, Injectable, Output } from "@angular/core";
import { HttpClient, HttpParams, HttpHeaders } from "@angular/common/http";
import { BehaviorSubject, Observable } from "rxjs";
import { tap } from "rxjs";
import { Router } from "@angular/router";
import { environment } from "../environment";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly apiUrl = `${environment.api}/token/`;
  private readonly tokenKey = "token";
  token_status: boolean = false;

  constructor(private http: HttpClient, private router: Router) {
    this.isAuthenticatedSubject.next(this.hasToken());
  }

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(
    this.hasToken()
  );
  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  hasToken(): boolean {
    this.token_status = !!localStorage.getItem(this.tokenKey);
    return !!localStorage.getItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser(): any {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  }

  getUserRole(): string | null {
    const user = this.getUser();
    return user && user.role ? user.role : null;
  }

  hasRole(role: string): boolean {
    const userRole = this.getUserRole();
    return userRole === role;
  }

  hasAnyRole(roles: string[]): boolean {
    const userRole = this.getUserRole();
    return userRole ? roles.includes(userRole) : false;
  }

  login(username: string, password: string): Observable<any> {
    const body = new HttpParams()
      .set("username", username)
      .set("password", password);

    const headers = new HttpHeaders().set(
      "Content-Type",
      "application/x-www-form-urlencoded"
    );

    return this.http
      .post<any>(`${this.apiUrl}`, body.toString(), { headers })
      .pipe(
        tap((response) => {
          localStorage.setItem(this.tokenKey, response.access_token);
          localStorage.setItem("user", JSON.stringify(response.user));
          this.isAuthenticatedSubject.next(true);
          
          // Redirect based on role after successful login
          this.redirectAfterLogin();
        })
      );
  }

  // Role-based redirection after login
  redirectAfterLogin(): void {
    const userRole = this.getUserRole();
    
    if (userRole === 'user') {
      this.router.navigate(['/order']);
    } else if (userRole === 'manufacturer') {
      this.router.navigate(['/manufacturer']);
    } else {
      // Default fallback
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem("user");
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(["/login"]);
  }
}