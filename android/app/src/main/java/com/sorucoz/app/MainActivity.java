package com.sorucoz.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

public class MainActivity extends BridgeActivity {
    private static final int RC_SIGN_IN = 9001;
    private static final String TAG = "MainActivity";
    private GoogleSignInClient mGoogleSignInClient;
    private com.getcapacitor.Bridge mBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Firebase Web Client ID - strings.xml'den al
        String webClientId = getString(
                getResources().getIdentifier("default_web_client_id", "string", getPackageName()));

        if (webClientId == null || webClientId.isEmpty() || webClientId.contains("YOUR_WEB_CLIENT_ID")) {
            Log.e(TAG, "default_web_client_id is not set in strings.xml");
            webClientId = "1026488924758-ph73nddcqp9skmtp5nn6l47d09beo2oe.apps.googleusercontent.com";
        }

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId)
                .requestEmail()
                .build();

        mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
    }

    @Override
    public void onStart() {
        super.onStart();

        // Bridge hazır olduğunda JavaScript interface ekle
        // Capacitor bridge'in hazır olmasını bekle
        try {
            com.getcapacitor.Bridge bridge = getBridge();
            if (bridge != null) {
                mBridge = bridge;
                WebView webView = bridge.getWebView();
                if (webView != null) {
                    webView.post(() -> {
                        try {
                            webView.getSettings().setUseWideViewPort(true);
                            webView.getSettings().setLoadWithOverviewMode(true);
                            webView.getSettings().setSupportZoom(true);
                            webView.getSettings().setBuiltInZoomControls(true);
                            webView.getSettings().setDisplayZoomControls(false);

                            webView.addJavascriptInterface(new GoogleSignInJSInterface(), "AndroidGoogleSignIn");
                            Log.d(TAG, "GoogleSignIn JavaScript interface added");
                        } catch (Exception e) {
                            Log.e(TAG, "Error adding JavaScript interface", e);
                        }
                    });
                } else {
                    Log.w(TAG, "WebView is null, will retry later");
                }
            } else {
                Log.w(TAG, "Bridge is null, will retry later");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onStart", e);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            handleSignInResult(task);
        }
    }

    private void handleSignInResult(Task<GoogleSignInAccount> completedTask) {
        try {
            GoogleSignInAccount account = completedTask.getResult(ApiException.class);

            if (account != null) {
                // JavaScript'e sonucu gönder - JSON string'i düzgün escape et
                String idToken = account.getIdToken() != null ? account.getIdToken() : "";
                String email = account.getEmail() != null ? account.getEmail() : "";
                String displayName = account.getDisplayName() != null ? account.getDisplayName() : "";
                String photoUrl = account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "";

                // JSON string'i düzgün escape et
                idToken = idToken.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
                email = email.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
                displayName = displayName.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
                photoUrl = photoUrl.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");

                // JSON oluştur ve JavaScript'e gönder
                String jsonResult = String.format(
                        "{\"idToken\":\"%s\",\"email\":\"%s\",\"displayName\":\"%s\",\"photoUrl\":\"%s\",\"accessToken\":null,\"serverAuthCode\":null}",
                        idToken, email, displayName, photoUrl);

                String jsCode = String.format(
                        "if (window.handleNativeGoogleSignIn) { window.handleNativeGoogleSignIn(%s); }",
                        jsonResult);

                runOnUiThread(() -> {
                    if (mBridge != null) {
                        WebView webView = mBridge.getWebView();
                        if (webView != null) {
                            webView.evaluateJavascript(jsCode, null);
                        }
                    }
                });
            }
        } catch (ApiException e) {
            Log.e(TAG, "signInResult:failed code=" + e.getStatusCode());

            // Hata durumunda JavaScript'e gönder
            String errorMessage = e.getMessage() != null ? e.getMessage().replace("\\", "\\\\").replace("\"", "\\\"")
                    : "Unknown error";
            String errorJson = String.format("{\"error\":\"%s\",\"code\":%d}", errorMessage, e.getStatusCode());
            String jsCode = String.format(
                    "if (window.handleNativeGoogleSignInError) { window.handleNativeGoogleSignInError(%s); }",
                    errorJson);

            runOnUiThread(() -> {
                if (mBridge != null) {
                    WebView webView = mBridge.getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(jsCode, null);
                    }
                }
            });
        }
    }

    // JavaScript'ten çağrılacak interface
    class GoogleSignInJSInterface {
        @JavascriptInterface
        public void signIn() {
            runOnUiThread(() -> {
                Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                startActivityForResult(signInIntent, RC_SIGN_IN);
            });
        }
    }
}
