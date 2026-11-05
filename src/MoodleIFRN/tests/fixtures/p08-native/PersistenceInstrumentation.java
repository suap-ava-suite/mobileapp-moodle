package br.edu.ifrn.experimental.p08;

import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import android.os.Looper;
import java.util.*;
import java.util.concurrent.*;
import io.sqlc.NativeSqliteProbe;

/** Self-instrumenting package with no Activity or network permission. Two separately started phases. */
public final class PersistenceInstrumentation extends Instrumentation {
    private Bundle arguments;
    private int passed;
    private final List<String> names=new ArrayList<>();
    private void check(boolean value,String name){if(!value)throw new IllegalStateException(name);passed++;names.add(name);}
    @Override public void onCreate(Bundle arguments){this.arguments=arguments;start();}
    @Override public void onStart(){
        Bundle result=new Bundle();ExecutorService executor=Executors.newFixedThreadPool(2);
        NativeSqliteProbe db=null;
        try{
            Context context=getTargetContext();
            if(!context.getPackageName().equals("br.edu.ifrn.experimental.p08.persistence"))throw new IllegalStateException("wrong sandbox");
            check(Looper.myLooper()!=Looper.getMainLooper(),"off-ui-thread");
            AndroidPorts.Crypto cipher=new AndroidPorts.Crypto(context);
            AndroidPorts.Prefs prefs=new AndroidPorts.Prefs(context);
            DurableVersions store=new DurableVersions(cipher,prefs,executor);
            db=new NativeSqliteProbe(context.getDatabasePath("p08-only.sqlite"));
            String phase=arguments==null?"":arguments.getString("phase","");
            if(phase.equals("seed")){
                Map<String,String> values=new HashMap<>();values.put("token","synthetic-token");values.put("privateToken","synthetic-private");
                check(store.store("A",values).get(15,TimeUnit.SECONDS).equals("A"),"commit-ack-success");
                check(!prefs.read(DurableVersions.collection("A")).get("token").equals("synthetic-token"),"ciphertext-not-plaintext");
                cipher.persistKeyMaterial();
                Map<String,String> legacy=new HashMap<>();legacy.put("token",cipher.encrypt("synthetic-legacy-token"));legacy.put("privateToken",cipher.encrypt("synthetic-legacy-private"));
                check(prefs.commit("synthetic-legacy-site",legacy,false),"legacy-fixture-seeded");
                db.execute("CREATE TABLE IF NOT EXISTS authority(id INTEGER PRIMARY KEY,epoch INTEGER,generation INTEGER,published TEXT)");
                db.execute("CREATE TABLE IF NOT EXISTS legacy(id TEXT PRIMARY KEY,info TEXT)");
                db.execute("INSERT OR IGNORE INTO legacy VALUES('synthetic-site','preserved')");
                db.execute("INSERT INTO authority VALUES(1,1,1,'A')");
                db.execute("BEGIN");
                db.execute("UPDATE authority SET published='obsolete'");
                boolean failed=false;try{db.execute("INSERT INTO missing_table VALUES(1)");}catch(Exception expected){failed=true;}
                db.execute("ROLLBACK");
                check(failed&&db.value("SELECT count(*) AS value FROM authority WHERE published='A'")==1,"sqlite-rollback");
                db.execute("BEGIN");db.execute("UPDATE authority SET generation=2,published='B'");db.execute("COMMIT");
                db.execute("UPDATE authority SET published='obsolete' WHERE epoch=1 AND generation=1");
                check(db.value("SELECT count(*) AS value FROM authority WHERE published='B'")==1,"conditional-generation");
                db.execute("UPDATE authority SET epoch=2,generation=3,published='new-account-reentry'");
                db.execute("UPDATE authority SET published='obsolete' WHERE epoch=1 AND generation=2");
                check(db.value("SELECT count(*) AS value FROM authority WHERE published='new-account-reentry'")==1,"conditional-epoch");
                db.close();db.open();
                check(db.value("SELECT count(*) AS value FROM authority WHERE published='new-account-reentry'")==1,"sqlite-reopen");
                check(db.value("SELECT count(*) AS value FROM legacy WHERE info='preserved'")==1,"legacy-sql-untouched");
            }else if(phase.equals("recover")){
                check(store.read("A").get(15,TimeUnit.SECONDS).get("token").equals("synthetic-token"),"secure-new-process");
                check(cipher.decrypt(prefs.read("synthetic-legacy-site").get("token")).equals("synthetic-legacy-token"),"legacy-cipher-new-process");
                check(db.value("SELECT count(*) AS value FROM authority WHERE published='new-account-reentry'")==1,"sqlite-new-process");
                check(store.deleteCancelled("A").get(15,TimeUnit.SECONDS).equals("A"),"scoped-durable-cleanup");
                check(cipher.decrypt(prefs.read("synthetic-legacy-site").get("token")).equals("synthetic-legacy-token"),"legacy-survives-cleanup");
            }else throw new IllegalArgumentException("phase must be seed or recover; never auto-clear");
            result.putString("p08_phase",phase);result.putInt("p08_passed",passed);result.putInt("p08_failed",0);result.putString("p08_cases",names.toString());
            finish(0,result);
        }catch(Throwable error){result.putInt("p08_passed",passed);result.putInt("p08_failed",1);result.putString("p08_failure_type",error.getClass().getSimpleName());finish(1,result);}
        finally{if(db!=null)db.close();executor.shutdownNow();}
    }
}
