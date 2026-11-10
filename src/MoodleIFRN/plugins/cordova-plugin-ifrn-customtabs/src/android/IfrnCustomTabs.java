package br.edu.ifrn.cordova.customtabs;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.text.TextUtils;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;

/** Abre somente o endpoint oficial de autorização Gov.br no browser do sistema. */
public final class IfrnCustomTabs extends CordovaPlugin {

    private static final String GOVBR_AUTH_HOST = "sso.acesso.gov.br";
    private static final int MAX_URL_LENGTH = 8192;
    private boolean opening;
    private CallbackContext returnCallback;

    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        if (!"open".equals(action)) {
            return false;
        }

        String rawUrl = args == null || args.length() == 0 ? null : args.optString(0, null);
        Uri uri = validateUrl(rawUrl);
        if (uri == null) {
            callbackContext.error("Destino de autenticação inválido.");
            return true;
        }

        synchronized (this) {
            if (opening) {
                callbackContext.error("Já existe uma janela de autenticação aberta.");
                return true;
            }
            opening = true;
        }

        cordova.getActivity().runOnUiThread(() -> launch(uri, callbackContext));
        return true;
    }

    private Uri validateUrl(String rawUrl) {
        if (TextUtils.isEmpty(rawUrl) || rawUrl.length() > MAX_URL_LENGTH
                || !rawUrl.equals(rawUrl.trim())) {
            return null;
        }
        for (int i = 0; i < rawUrl.length(); i++) {
            if (Character.isISOControl(rawUrl.charAt(i))) {
                return null;
            }
        }

        Uri uri = Uri.parse(rawUrl);
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (!uri.isHierarchical() || scheme == null || !"https".equalsIgnoreCase(scheme)
                || host == null || !GOVBR_AUTH_HOST.equalsIgnoreCase(host)
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
            return null;
        }

        return uri;
    }

    private void launch(Uri uri, CallbackContext callbackContext) {
        if (cordova.getActivity() == null || cordova.getActivity().isFinishing()) {
            releaseOpening();
            callbackContext.error("Não foi possível abrir o navegador.");
            return;
        }

        String browserPackage = CustomTabsClient.getPackageName(cordova.getActivity(), null);
        if (!TextUtils.isEmpty(browserPackage)) {
            try {
                CustomTabsIntent customTabs = new CustomTabsIntent.Builder()
                        .setShowTitle(true)
                        .setToolbarColor(Color.rgb(19, 81, 180))
                        .build();
                customTabs.intent.setPackage(browserPackage);
                customTabs.launchUrl(cordova.getActivity(), uri);
                sendOpened(callbackContext, "custom-tab");
                return;
            } catch (ActivityNotFoundException | SecurityException error) {
                // A seleção do provider pode ficar obsoleta entre a consulta e a abertura.
            }
        }

        try {
            Intent externalBrowser = new Intent(Intent.ACTION_VIEW, uri);
            cordova.getActivity().startActivity(externalBrowser);
            sendOpened(callbackContext, "external-browser");
        } catch (ActivityNotFoundException | SecurityException error) {
            releaseOpening();
            callbackContext.error("Não há navegador disponível para abrir a autenticação.");
        }
    }

    private synchronized void releaseOpening() {
        opening = false;
        returnCallback = null;
    }

    private void sendOpened(CallbackContext callbackContext, String mode) {
        synchronized (this) {
            returnCallback = callbackContext;
        }

        PluginResult result = new PluginResult(PluginResult.Status.OK, mode);
        result.setKeepCallback(true);
        callbackContext.sendPluginResult(result);
    }

    @Override
    public void onResume(boolean multitasking) {
        super.onResume(multitasking);
        CallbackContext callback;
        synchronized (this) {
            callback = returnCallback;
            returnCallback = null;
            opening = false;
        }
        if (callback != null) {
            callback.sendPluginResult(new PluginResult(PluginResult.Status.OK, "browser-returned"));
        }
    }

    @Override
    public void onReset() {
        releaseOpening();
    }
}
