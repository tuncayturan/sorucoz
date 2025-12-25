package com.sorucoz.app;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

@CapacitorPlugin(name = "GoogleSignIn")
public class GoogleSignInPlugin extends Plugin {

    private static final int RC_SIGN_IN = 9001;
    private static final String TAG = "GoogleSignInPlugin";
    private GoogleSignInClient mGoogleSignInClient;
    private PluginCall savedCall;

    @Override
    public void load() {
        super.load();
        
        // Firebase Web Client ID - strings.xml'den al
        // Firebase Console > Project Settings > General > Your apps > Web app > OAuth 2.0 Client ID
        String webClientId = getContext().getString(
            getContext().getResources().getIdentifier("default_web_client_id", "string", getContext().getPackageName())
        );
        
        // Eğer string resource yoksa veya boşsa, hata ver
        if (webClientId == null || webClientId.isEmpty() || webClientId.contains("YOUR_WEB_CLIENT_ID")) {
            Log.e(TAG, "default_web_client_id is not set in strings.xml. Please add it from Firebase Console.");
            // Fallback: Firebase project'ten web client ID formatı
            // Format: {projectNumber}-{hash}.apps.googleusercontent.com
            webClientId = "1026488924758-d4c081b5f87a62f10ed9f7.apps.googleusercontent.com";
            Log.w(TAG, "Using fallback web client ID. This may not work. Please configure strings.xml properly.");
        }

        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestIdToken(webClientId)
                .requestEmail()
                .build();

        mGoogleSignInClient = GoogleSignIn.getClient(getActivity(), gso);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        savedCall = call;
        Intent signInIntent = mGoogleSignInClient.getSignInIntent();
        startActivityForResult(call, signInIntent, RC_SIGN_IN);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        mGoogleSignInClient.signOut()
            .addOnCompleteListener(getActivity(), task -> {
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            });
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == RC_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            handleSignInResult(task);
        }
    }

    private void handleSignInResult(Task<GoogleSignInAccount> completedTask) {
        try {
            GoogleSignInAccount account = completedTask.getResult(ApiException.class);
            
            if (account != null && savedCall != null) {
                JSObject result = new JSObject();
                result.put("idToken", account.getIdToken());
                result.put("accessToken", null); // Google Sign-In doesn't provide access token directly
                result.put("email", account.getEmail());
                result.put("displayName", account.getDisplayName());
                result.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null);
                result.put("serverAuthCode", account.getServerAuthCode());
                
                savedCall.resolve(result);
                savedCall = null;
            }
        } catch (ApiException e) {
            Log.e(TAG, "signInResult:failed code=" + e.getStatusCode());
            if (savedCall != null) {
                savedCall.reject("Google Sign-In failed: " + e.getMessage(), String.valueOf(e.getStatusCode()));
                savedCall = null;
            }
        }
    }
}

