package br.edu.ifrn.experimental.p08;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

/** JVM tests of control flow. Preferences, disk and encryption below are MOCKS, not Android. */
public final class DurableVersionsJvmTest {
    static int passed;
    static void check(boolean condition) { if (!condition) throw new AssertionError("synthetic assertion"); }
    static Map<String,String> credentials() { Map<String,String> m=new HashMap<>();m.put("token","synthetic-token");m.put("privateToken","synthetic-private");return m; }
    static final class Prefs implements DurableVersions.Preferences {
        final Map<String,Map<String,String>> memory=new ConcurrentHashMap<>(), disk=new ConcurrentHashMap<>();
        boolean fail=false, keys=true; String thread, holdCollection; CountDownLatch entered, release;
        public Map<String,String> read(String c) { return new HashMap<>(memory.getOrDefault(c,Collections.emptyMap())); }
        public boolean commit(String c,Map<String,String> values,boolean clear) throws Exception {
            thread=Thread.currentThread().getName();
            if(entered!=null&&(holdCollection==null||holdCollection.equals(c))){entered.countDown();if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("gate timeout");}
            memory.put(c,clear?new HashMap<>():new HashMap<>(values));
            if(fail)return false;
            disk.put(c,new HashMap<>(memory.get(c)));return true;
        }
        void restart(){memory.clear();disk.forEach((k,v)->memory.put(k,new HashMap<>(v)));}
    }
    static DurableVersions make(Prefs p,ExecutorService executor) {
        return new DurableVersions(new DurableVersions.CipherPort(){
            public void persistKeyMaterial(){if(!p.keys)throw new IllegalStateException("key persistence unconfirmed");}
            public String encrypt(String s){return "mock-encrypted:"+s;}
            public String decrypt(String s){if(!s.startsWith("mock-encrypted:"))throw new IllegalStateException("mock invalid ciphertext");return s.substring(15);}
        },p,executor);
    }
    static void failure(Future<?> f) throws Exception {try{f.get(5,TimeUnit.SECONDS);throw new AssertionError("expected failure");}catch(ExecutionException expected){}}
    static void scenario(String name,Callable<Void> body)throws Exception{body.call();passed++;System.out.println("PASS "+name);}
    public static void main(String[] args)throws Exception{
        ExecutorService worker=Executors.newFixedThreadPool(2,r->new Thread(r,"p08-worker"));
        try{
            scenario("success-off-caller-thread",()->{Prefs p=new Prefs();DurableVersions d=make(p,worker);check(d.store("A",credentials()).get().equals("A"));check(p.thread.equals("p08-worker"));check(!p.disk.get(DurableVersions.collection("A")).get("token").equals("synthetic-token"));return null;});
            scenario("commit-false-is-not-ack",()->{Prefs p=new Prefs();p.fail=true;DurableVersions d=make(p,worker);failure(d.store("A",credentials()));check(!p.memory.isEmpty());check(p.disk.isEmpty());p.restart();check(p.memory.isEmpty());return null;});
            scenario("key-persistence-failure-stops-credential-write",()->{Prefs p=new Prefs();p.keys=false;failure(make(p,worker).store("A",credentials()));check(p.memory.isEmpty());return null;});
            scenario("restart-restores-confirmed-version",()->{Prefs p=new Prefs();DurableVersions d=make(p,worker);d.store("A",credentials()).get();p.restart();check(d.read("A").get().get("token").equals("synthetic-token"));return null;});
            scenario("pending-commit-does-not-ack-early",()->{Prefs p=new Prefs();p.entered=new CountDownLatch(1);p.release=new CountDownLatch(1);Future<String> f=make(p,worker).store("A",credentials());check(p.entered.await(5,TimeUnit.SECONDS));check(!f.isDone());p.release.countDown();check(f.get().equals("A"));return null;});
            scenario("snapshot-does-not-follow-caller-mutation",()->{Prefs p=new Prefs();p.entered=new CountDownLatch(1);p.release=new CountDownLatch(1);Map<String,String> c=credentials();Future<String> f=make(p,worker).store("A",c);check(p.entered.await(5,TimeUnit.SECONDS));c.put("token","synthetic-changed");p.release.countDown();f.get();check(make(p,worker).read("A").get().get("token").equals("synthetic-token"));return null;});
            scenario("late-A-namespace-cannot-overwrite-B",()->{Prefs p=new Prefs();p.entered=new CountDownLatch(1);p.release=new CountDownLatch(1);p.holdCollection=DurableVersions.collection("A");DurableVersions d=make(p,worker);Future<String> old=d.store("A",credentials());check(p.entered.await(5,TimeUnit.SECONDS));Map<String,String> b=credentials();b.put("token","synthetic-token-B");d.store("B",b).get();p.release.countDown();old.get();check(d.read("B").get().get("token").equals("synthetic-token-B"));check(p.disk.containsKey(DurableVersions.collection("A")));return null;});
            scenario("cleanup-is-scoped-to-cancelled-version",()->{Prefs p=new Prefs();DurableVersions d=make(p,worker);d.store("A",credentials()).get();d.store("B",credentials()).get();p.memory.put("legacy-site",credentials());d.deleteCancelled("A").get();check(d.read("B").get().containsKey("token"));check(p.memory.containsKey("legacy-site"));return null;});
            scenario("cleanup-failure-not-reported-as-success",()->{Prefs p=new Prefs();DurableVersions d=make(p,worker);d.store("A",credentials()).get();p.fail=true;failure(d.deleteCancelled("A"));check(!p.disk.get(DurableVersions.collection("A")).isEmpty());return null;});
            scenario("existing-version-refuses-overwrite",()->{Prefs p=new Prefs();DurableVersions d=make(p,worker);d.store("A",credentials()).get();failure(d.store("A",credentials()));return null;});
            scenario("invalid-namespace-refused",()->{try{DurableVersions.collection("../legacy-site");throw new AssertionError();}catch(IllegalArgumentException ok){}return null;});
            scenario("missing-version-fails-closed",()->{failure(make(new Prefs(),worker).read("absent"));return null;});
        }finally{worker.shutdownNow();check(worker.awaitTermination(5,TimeUnit.SECONDS));}
        System.out.println("{\"runtime\":\"JVM-with-mocks\",\"passed\":"+passed+",\"failed\":0}");
    }
}
