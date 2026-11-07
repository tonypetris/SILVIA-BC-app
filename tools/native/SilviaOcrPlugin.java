package io.github.tonypetris.silviabc;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Reads the text of a picture with ML Kit (Latin model bundled in the app: works offline). */
@CapacitorPlugin(name = "SilviaOcr")
public class SilviaOcrPlugin extends Plugin {
    private TextRecognizer recognizer;

    @PluginMethod
    public void recognize(PluginCall call) {
        String img = call.getString("image");
        if (img == null || img.isEmpty()) { call.reject("no image"); return; }
        int comma = img.indexOf(',');
        if (img.startsWith("data:") && comma > 0) img = img.substring(comma + 1);
        Bitmap bmp;
        try {
            byte[] bytes = Base64.decode(img, Base64.DEFAULT);
            bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (Exception e) { call.reject("bad image"); return; }
        if (bmp == null) { call.reject("bad image"); return; }
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(InputImage.fromBitmap(bmp, 0))
            .addOnSuccessListener(t -> {
                JSObject r = new JSObject();
                JSArray lines = new JSArray();
                for (Text.TextBlock b : t.getTextBlocks()) for (Text.Line l : b.getLines()) lines.put(l.getText());
                r.put("text", t.getText());
                r.put("lines", lines);
                call.resolve(r);
            })
            .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
    }
}
