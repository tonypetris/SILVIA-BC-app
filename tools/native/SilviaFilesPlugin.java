package io.github.tonypetris.silviabc;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * System "Open" / "Save as" windows (Storage Access Framework): Google Drive, Downloads, SD card...
 * appear as locations, like in any other app. Saving again rewrites the same file.
 * Nothing is remembered by the app: the file address lives only in the page memory.
 */
@CapacitorPlugin(name = "SilviaFiles")
public class SilviaFilesPlugin extends Plugin {
    private JSObject incoming;

    @Override
    public void load() {
        // app started from "Share" / "Open with"
        try { handleIncoming(getActivity().getIntent()); } catch (Exception ignored) { }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handleIncoming(intent);
    }

    /** A project shared to SILVIA (Invia / Condividi) or opened with SILVIA (Apri con). */
    private void handleIncoming(Intent intent) {
        if (intent == null) return;
        String a = intent.getAction();
        Uri u = null;
        String text = null;
        if (Intent.ACTION_SEND.equals(a)) {
            u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u == null) text = intent.getStringExtra(Intent.EXTRA_TEXT);
        } else if (Intent.ACTION_VIEW.equals(a)) {
            u = intent.getData();
        } else return;
        JSObject r = new JSObject();
        try {
            if (u != null) { r.put("name", name(u)); r.put("text", read(u)); }
            else if (text != null) { r.put("name", "SILVIA-BC.json"); r.put("text", text); }
            else return;
        } catch (Exception e) { r.put("error", String.valueOf(e.getMessage())); }
        r.put("via", Intent.ACTION_SEND.equals(a) ? "share" : "view");
        incoming = r;
        intent.setAction(Intent.ACTION_MAIN);   // not handled twice (rotation, resume)
        notifyListeners("fileReceived", r, true);
    }

    /** For a page that starts listening late: the last received file, once. */
    @PluginMethod
    public void takeIncoming(PluginCall call) {
        JSObject r = incoming != null ? incoming : new JSObject();
        incoming = null;
        call.resolve(r);
    }

    @PluginMethod
    public void open(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(call, i, "openResult");
    }

    @ActivityCallback
    private void openResult(PluginCall call, ActivityResult res) {
        if (call == null) return;
        Uri u = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (u == null) { call.reject("cancel"); return; }
        try {
            JSObject r = new JSObject();
            r.put("uri", u.toString());
            r.put("name", name(u));
            r.put("text", read(u));
            call.resolve(r);
        } catch (Exception e) { call.reject("read: " + e.getMessage()); }
    }

    @PluginMethod
    public void save(PluginCall call) {
        String uri = call.getString("uri");
        if (uri != null && !uri.isEmpty()) {
            try {
                Uri u = Uri.parse(uri);
                write(u, call.getString("text", ""));
                JSObject r = new JSObject();
                r.put("uri", uri);
                r.put("name", name(u));
                call.resolve(r);
            } catch (Exception e) { call.reject("write: " + e.getMessage()); }
            return;
        }
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "application/json"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "SILVIA-BC.json"));
        startActivityForResult(call, i, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult res) {
        if (call == null) return;
        Uri u = res.getResultCode() == Activity.RESULT_OK && res.getData() != null ? res.getData().getData() : null;
        if (u == null) { call.reject("cancel"); return; }
        try {
            write(u, call.getString("text", ""));
            JSObject r = new JSObject();
            r.put("uri", u.toString());
            r.put("name", name(u));
            call.resolve(r);
        } catch (Exception e) { call.reject("write: " + e.getMessage()); }
    }

    private String read(Uri u) throws Exception {
        try (InputStream in = getContext().getContentResolver().openInputStream(u)) {
            if (in == null) throw new Exception("no stream");
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return new String(b.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void write(Uri u, String text) throws Exception {
        OutputStream os;
        try { os = getContext().getContentResolver().openOutputStream(u, "wt"); }
        catch (Exception e) { os = getContext().getContentResolver().openOutputStream(u, "w"); }
        if (os == null) throw new Exception("no stream");
        try (OutputStream o = os) { o.write(text.getBytes(StandardCharsets.UTF_8)); o.flush(); }
    }

    private String name(Uri u) {
        try (Cursor c = getContext().getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        String s = u.getLastPathSegment();
        return s == null ? "SILVIA-BC.json" : s;
    }
}
