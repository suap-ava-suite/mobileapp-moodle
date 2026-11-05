package io.sqlc;
import java.io.File;
import org.apache.cordova.CallbackContext;
import org.json.*;

/** Calls the actual NDK connector helper; no Moodle database and no application credentials. */
public final class NativeSqliteProbe {
    private SQLiteConnectorDatabase db;
    private final File file;
    public NativeSqliteProbe(File file)throws Exception{this.file=file;if(!file.getParentFile().exists()&&!file.getParentFile().mkdirs())throw new IllegalStateException("private test directory unavailable");open();}
    public void open()throws Exception{db=new SQLiteConnectorDatabase();db.open(file);}
    public void close(){db.closeDatabaseNow();}
    public JSONArray execute(String sql,Object...params)throws Exception{
        CallbackContext c=new CallbackContext();
        JSONArray values=new JSONArray();for(Object p:params)values.put(p);
        db.executeSqlBatch(new String[]{sql},new JSONArray[]{values},c);
        if(c.error!=null||c.rows==null||!c.rows.getJSONObject(0).getString("type").equals("success"))throw new IllegalStateException("synthetic SQL failure");
        return c.rows.getJSONObject(0).getJSONObject("result").optJSONArray("rows");
    }
    public long value(String sql)throws Exception{return execute(sql).getJSONObject(0).getLong("value");}
}
