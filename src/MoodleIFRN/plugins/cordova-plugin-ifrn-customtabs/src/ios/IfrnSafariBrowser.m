#import <Cordova/CDVPlugin.h>
#import <SafariServices/SafariServices.h>
#import <UIKit/UIKit.h>

@interface IfrnSafariBrowser : CDVPlugin <SFSafariViewControllerDelegate>

@property(nonatomic, strong) SFSafariViewController *browser;
@property(nonatomic, copy) NSString *openCallbackId;

@end

@implementation IfrnSafariBrowser

- (void)open:(CDVInvokedUrlCommand *)command {
    id candidate = command.arguments.firstObject;
    if (![candidate isKindOfClass:[NSString class]]) {
        [self sendError:@"Destino de autenticação inválido." callbackId:command.callbackId];
        return;
    }

    NSString *rawURL = (NSString *) candidate;
    NSURL *url = [self validatedURL:rawURL];
    if (url == nil) {
        [self sendError:@"Destino de autenticação inválido." callbackId:command.callbackId];
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.browser != nil || self.viewController.presentedViewController != nil) {
            [self sendError:@"Já existe uma janela de autenticação aberta." callbackId:command.callbackId];
            return;
        }

        SFSafariViewController *browser = [[SFSafariViewController alloc] initWithURL:url];
        browser.delegate = self;
        self.browser = browser;
        self.openCallbackId = command.callbackId;

        [self.viewController presentViewController:browser animated:YES completion:^{
            CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                                        messageAsString:@"safari-view-controller"];
            [result setKeepCallbackAsBool:YES];
            [self.commandDelegate sendPluginResult:result callbackId:command.callbackId];
        }];
    });
}

- (NSURL *)validatedURL:(NSString *)rawURL {
    if (rawURL.length == 0 || rawURL.length > 8192
            || ![rawURL isEqualToString:[rawURL stringByTrimmingCharactersInSet:
                [NSCharacterSet whitespaceAndNewlineCharacterSet]]]
            || [rawURL rangeOfCharacterFromSet:[NSCharacterSet controlCharacterSet]].location != NSNotFound) {
        return nil;
    }

    NSURLComponents *components = [NSURLComponents componentsWithString:rawURL];
    NSNumber *port = components.port;
    if (components == nil
            || ![components.scheme.lowercaseString isEqualToString:@"https"]
            || ![components.host.lowercaseString isEqualToString:@"sso.acesso.gov.br"]
            || components.user != nil
            || components.password != nil
            || (port != nil && port.integerValue != 443)) {
        return nil;
    }

    return [NSURL URLWithString:rawURL];
}

- (void)safariViewControllerDidFinish:(SFSafariViewController *)controller {
    NSString *callbackId = self.openCallbackId;
    self.openCallbackId = nil;
    self.browser = nil;

    if (callbackId != nil) {
        CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK
                                                    messageAsString:@"browser-returned"];
        [self.commandDelegate sendPluginResult:result callbackId:callbackId];
    }
}

- (void)sendError:(NSString *)message callbackId:(NSString *)callbackId {
    CDVPluginResult *result = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:message];
    [self.commandDelegate sendPluginResult:result callbackId:callbackId];
}

@end
