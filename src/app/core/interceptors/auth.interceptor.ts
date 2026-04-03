// src/app/core/interceptors/auth.interceptor.ts
// ══════════════════════════════════════════════════════════════════
// Intercepteur JWT — ajoute automatiquement le token Bearer
// à TOUTES les requêtes HTTP sauf le login
// ══════════════════════════════════════════════════════════════════

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Ne pas ajouter le token sur le login
  const isLoginUrl = req.url.includes('/login/');
  if (isLoginUrl) {
    return next(req);
  }

  // Récupérer le token depuis localStorage
  const token = localStorage.getItem('access');

  // Cloner la requête avec le header Authorization
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    : req;

  // Envoyer la requête et gérer les erreurs
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expiré ou invalide → rediriger vers login
        console.warn('Token invalide ou expiré — redirection login');
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
        localStorage.removeItem('user');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};