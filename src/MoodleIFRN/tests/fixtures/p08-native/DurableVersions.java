package br.edu.ifrn.experimental.p08;

import java.util.*;
import java.util.concurrent.*;

/** Experimental port contract, shared by JVM tests and the isolated Android harness. */
public final class DurableVersions {
    public interface CipherPort {
        void persistKeyMaterial() throws Exception;
        String encrypt(String value) throws Exception;
        String decrypt(String value) throws Exception;
    }
    public interface Preferences {
        Map<String, String> read(String collection) throws Exception;
        boolean commit(String collection, Map<String, String> encrypted, boolean clear) throws Exception;
    }
    private final CipherPort cipher;
    private final Preferences preferences;
    private final ExecutorService worker;
    public DurableVersions(CipherPort cipher, Preferences preferences, ExecutorService worker) {
        this.cipher = cipher; this.preferences = preferences; this.worker = worker;
    }
    public static String collection(String version) {
        if (version == null || !version.matches("[a-zA-Z0-9-]{1,100}")) throw new IllegalArgumentException("invalid version");
        return "ifrn-p08-" + version;
    }
    public Future<String> store(String version, Map<String, String> values) {
        final String collection = collection(version);
        final Map<String, String> snapshot = Collections.unmodifiableMap(new HashMap<>(values));
        return worker.submit(() -> {
            // Key initialization itself may use asynchronous writes in the legacy encryption helper.
            cipher.persistKeyMaterial();
            Map<String, String> encoded = new HashMap<>();
            if (!snapshot.containsKey("token") || !snapshot.containsKey("privateToken")) throw new IllegalArgumentException("incomplete credentials");
            if (!preferences.read(collection).isEmpty()) throw new IllegalStateException("immutable version already exists");
            for (Map.Entry<String, String> entry : snapshot.entrySet()) {
                if (!entry.getKey().equals("token") && !entry.getKey().equals("privateToken")) throw new IllegalArgumentException("unsupported field");
                encoded.put(entry.getKey(), cipher.encrypt(entry.getValue()));
            }
            encoded.put("version", cipher.encrypt(version));
            // false means unknown/failed durability, NOT a successful store followed by compensating deletion.
            if (!preferences.commit(collection, encoded, false)) throw new IllegalStateException("credential persistence unconfirmed");
            return version;
        });
    }
    public Future<Map<String, String>> read(String version) {
        final String collection = collection(version);
        return worker.submit(() -> {
            Map<String, String> decoded = new HashMap<>();
            for (Map.Entry<String, String> entry : preferences.read(collection).entrySet()) decoded.put(entry.getKey(), cipher.decrypt(entry.getValue()));
            if (!version.equals(decoded.get("version")) || !decoded.containsKey("token") || !decoded.containsKey("privateToken")) {
                throw new IllegalStateException("version missing or incomplete");
            }
            return Collections.unmodifiableMap(decoded);
        });
    }
    /** Caller MUST supply a GC-eligible tombstone. This port does not own the SQLite publication decision. */
    public Future<String> deleteCancelled(String version) {
        final String collection = collection(version);
        return worker.submit(() -> {
            if (!preferences.commit(collection, Collections.emptyMap(), true)) throw new IllegalStateException("deletion unconfirmed");
            return version;
        });
    }
}
