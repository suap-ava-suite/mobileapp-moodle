package org.apache.cordova;
import org.json.JSONArray;
/** Shim ONLY for helper tests; the actual Cordova bridge is not packaged or claimed tested here. */
public class CallbackContext {
    public JSONArray rows;
    public String error;
    public void success(JSONArray result){rows=result;}
    public void error(String value){error=value;}
}
