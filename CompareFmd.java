import com.digitalpersona.uareu.Engine;
import com.digitalpersona.uareu.Fmd;
import com.digitalpersona.uareu.Importer;
import com.digitalpersona.uareu.UareUException;
import com.digitalpersona.uareu.UareUGlobal;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class CompareFmd {
    private static class Record {
        int id;
        String name;
        String fmd;

        Record(int id, String name, String fmd) {
            this.id = id;
            this.name = name;
            this.fmd = fmd;
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            printError("Usage: CompareFmd candidate.base64 db.tsv");
            System.exit(2);
        }

        String candidateBase64 = Files.readString(Path.of(args[0])).trim();
        List<Record> records = readRecords(args[1]);
        if (records.isEmpty()) {
            printError("Belum ada FMD tersimpan.");
            System.exit(1);
        }

        try {
            Importer importer = UareUGlobal.GetImporter();
            Engine engine = UareUGlobal.GetEngine();
            Fmd candidate = importer.ImportFmd(Base64.getDecoder().decode(candidateBase64), Fmd.Format.ANSI_378_2004, Fmd.Format.ANSI_378_2004);

            int threshold = Engine.PROBABILITY_ONE / 100000;
            int bestScore = Integer.MAX_VALUE;
            Record bestRecord = null;

            for (Record record : records) {
                Fmd stored = importer.ImportFmd(Base64.getDecoder().decode(record.fmd), Fmd.Format.ANSI_378_2004, Fmd.Format.ANSI_378_2004);
                int score = engine.Compare(candidate, 0, stored, 0);
                if (score < bestScore) {
                    bestScore = score;
                    bestRecord = record;
                }
            }

            boolean matched = bestRecord != null && bestScore < threshold;
            System.out.println("{"
                + "\"success\":true,"
                + "\"matched\":" + matched + ","
                + "\"id\":" + (bestRecord == null ? "null" : bestRecord.id) + ","
                + "\"nama\":\"" + json(bestRecord == null ? "" : bestRecord.name) + "\","
                + "\"score\":" + bestScore + ","
                + "\"threshold\":" + threshold
                + "}");
        } catch (UareUException error) {
            printError("Compare FMD gagal. code=" + error.getCode() + " " + error);
            System.exit(1);
        }
    }

    private static List<Record> readRecords(String path) throws Exception {
        List<Record> records = new ArrayList<>();
        for (String line : Files.readAllLines(Path.of(path))) {
            if (line.trim().isEmpty()) continue;
            String[] parts = line.split("\t", 3);
            if (parts.length == 3) {
                records.add(new Record(Integer.parseInt(parts[0]), parts[1], parts[2]));
            }
        }
        return records;
    }

    private static void printError(String message) {
        System.out.println("{\"success\":false,\"error\":\"" + json(message) + "\"}");
    }

    private static String json(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
