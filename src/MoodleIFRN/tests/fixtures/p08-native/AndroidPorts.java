package br.edu.ifrn.experimental.p08;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.adobe.phonegap.push.EncryptionHandler;
import java.util.*;

/** Isolated Android implementation. Uses the EXISTING encryption helper, never a replacement cipher. */
public final class AndroidPorts {
    public static final class Crypto implements DurableVersions.CipherPort {
        final Context context;
        public Crypto(Context context){this.context=context;}
        public void persistKeyMaterial() throws Exception {
            if(Build.VERSION.SDK_INT<23)throw new IllegalStateException("encryption required");
            synchronized(EncryptionHandler.class){
                EncryptionHandler.Companion.getPublicKey(context);
                SharedPreferences p=context.getSharedPreferences("com.adobe.phonegap.push",Context.MODE_PRIVATE);
                String privateKey=p.getString("SODIUM_KEY_PRIVATE",null),publicKey=p.getString("SODIUM_KEY_PUBLIC",null);
                if(privateKey==null||publicKey==null)throw new IllegalStateException("key material incomplete");
                // SAME bytes/encoding as the existing helper; explicit disk barrier, not readback as durability proof.
                if(!p.edit().putString("SODIUM_KEY_PRIVATE",privateKey).putString("SODIUM_KEY_PUBLIC",publicKey).commit()){
                    throw new IllegalStateException("key persistence unconfirmed");
                }
            }
        }
        public String encrypt(String value){return EncryptionHandler.Companion.encrypt(context,value);}
        public String decrypt(String value){return EncryptionHandler.Companion.decrypt(context,value);}
    }
    public static final class Prefs implements DurableVersions.Preferences {
        final Context context;
        public Prefs(Context context){this.context=context;}
        SharedPreferences prefs(String c){return context.getSharedPreferences("moodlemobile_shared_prefs_"+c,Context.MODE_PRIVATE);}
        public Map<String,String> read(String c){
            Map<String,String> result=new HashMap<>();
            for(Map.Entry<String,?> e:prefs(c).getAll().entrySet()){
                if(!(e.getValue() instanceof String))throw new IllegalStateException("invalid stored type");
                result.put(e.getKey(),(String)e.getValue());
            }
            return result;
        }
        public boolean commit(String c,Map<String,String> values,boolean clear){
            SharedPreferences.Editor editor=prefs(c).edit();
            if(clear)editor.clear();
            for(Map.Entry<String,String> e:values.entrySet())editor.putString(e.getKey(),e.getValue());
            return editor.commit();
        }
    }
}
