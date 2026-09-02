import { NgModule, Type, provideAppInitializer } from '@angular/core';
import { Routes } from '@angular/router';

import { AppRoutingModule } from '@/app/app-routing.module';
import { CoreLoginHelper } from './services/login-helper';
import { redirectGuard } from '@guards/redirect';
import { CoreLoginCronHandler } from './services/handlers/cron';
import { CoreCronDelegate } from '@services/cron';
import { CoreEvents } from '@static/events';
import { hasSitesGuard } from './guards/has-sites';

/**
 * Get login services.
 *
 * @returns Returns login services.
 */
export async function getLoginServices(): Promise<Type<unknown>[]> {
    const { CoreLoginHelperProvider } = await import('@features/login/services/login-helper');

    return [
        CoreLoginHelperProvider,
    ];
}

const appRoutes: Routes = [
    {
        path: 'login',
        loadChildren: () => [
            {
    path: '',
    pathMatch: 'full',
    redirectTo: 'marketplace-ifrn',
},

{
    path: 'marketplace-ifrn',
    loadComponent: () =>
        import('@/MoodleIFRN/marketplace-ifrn/marketplace-ifrn')
            .then(m => m.MarketplaceIfrnPage),
},

{
    path: 'ifrn-login',
    loadComponent: () =>
        import('@/MoodleIFRN/ifrn-login/ifrn-login')
            .then(m => m.IfrnLoginPage),
},
            {
                path: 'site',
                loadComponent: () => import('@features/login/pages/site/site'),
            },
            {
                path: 'credentials',
                loadComponent: () => CoreLoginHelper.getCredentialsPage(),
            },
            {
                path: 'sites',
                loadComponent: () => import('@features/login/pages/sites/sites'),
                canActivate: [hasSitesGuard],
            },
            {
                path: 'forgottenpassword',
                loadComponent: () => import('@features/login/pages/forgotten-password/forgotten-password'),
            },
            {
                path: 'changepassword',
                loadComponent: () => import('@features/login/pages/change-password/change-password'),
            },
            {
                path: 'emailsignup',
                loadComponent: () => import('@features/login/pages/email-signup/email-signup'),
            },
            {
                path: 'reconnect',
                loadComponent: () => CoreLoginHelper.getReconnectPage(),
            },
        ],
        canActivate: [redirectGuard],
    },
    {
        path: 'hello-world',
        loadComponent: () =>
            import('@features/hello_world/hello-world')
                .then(module => module.HelloWorldPage),
    },
    {
        path: 'logout',
        loadComponent: () => import('@features/login/pages/logout/logout'),
    },
];
@NgModule({
    imports: [
        AppRoutingModule.forChild(appRoutes),
    ],
    providers: [
        provideAppInitializer(async () => {
            CoreCronDelegate.register(CoreLoginCronHandler.instance);

            CoreEvents.on(CoreEvents.SESSION_EXPIRED, (data) => {
                CoreLoginHelper.sessionExpired(data);
            });

            CoreEvents.on(CoreEvents.PASSWORD_CHANGE_FORCED, (data) => {
                CoreLoginHelper.passwordChangeForced(data.siteId);
            });

            await CoreLoginHelper.initialize();
        }),
    ],
})
export class CoreLoginModule {}
