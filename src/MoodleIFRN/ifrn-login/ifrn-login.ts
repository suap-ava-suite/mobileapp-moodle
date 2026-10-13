import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CoreNavigator } from '@services/navigator';

/** Compatibilidade com links antigos e recuperação de conta dos cursos. */
@Component({ selector: 'page-ifrn-login', templateUrl: './ifrn-login.html' })
export class IfrnLoginPage implements OnInit {
    private readonly router = inject(Router);
    async ngOnInit(): Promise<void> {
        const forceLogin = CoreNavigator.getRouteBooleanParam('forceLogin');
        await this.router.navigate(['/login/marketplace-ifrn'], {
            replaceUrl: true,
            queryParams: {
                directSuap: true,
                forceLogin,
                username: forceLogin ? CoreNavigator.getRouteParam<string>('username') : undefined,
            },
        });
    }
}
