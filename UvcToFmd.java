import com.digitalpersona.uareu.Engine;
import com.digitalpersona.uareu.Fmd;
import com.digitalpersona.uareu.UareUException;
import com.digitalpersona.uareu.UareUGlobal;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.util.Base64;

public class UvcToFmd {
    private static class Attempt {
        int width;
        int height;
        int xOffset;
        int yOffset;
        boolean invert;

        Attempt(int width, int height, int xOffset, int yOffset, boolean invert) {
            this.width = width;
            this.height = height;
            this.xOffset = xOffset;
            this.yOffset = yOffset;
            this.invert = invert;
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            printError("Usage: UvcToFmd image.png");
            System.exit(2);
        }

        BufferedImage image = ImageIO.read(new File(args[0]));
        if (image == null) {
            printError("PNG tidak bisa dibaca.");
            System.exit(1);
        }

        int sourceWidth = image.getWidth();
        int sourceHeight = image.getHeight();
        Attempt[] attempts = new Attempt[] {
            new Attempt(512, 512, 84, 14, false),
            new Attempt(512, 512, 764, 14, false),
            new Attempt(512, 512, 84, 14, true),
            new Attempt(512, 512, 764, 14, true),
            new Attempt(540, 540, 70, 0, false),
            new Attempt(540, 540, 750, 0, false),
            new Attempt(540, 540, 70, 0, true),
            new Attempt(540, 540, 750, 0, true),
            new Attempt(sourceWidth / 2, sourceHeight, 0, 0, false),
            new Attempt(sourceWidth / 2, sourceHeight, sourceWidth / 2, 0, false),
            new Attempt(sourceWidth / 2, sourceHeight, 0, 0, true),
            new Attempt(sourceWidth / 2, sourceHeight, sourceWidth / 2, 0, true),
            new Attempt(sourceWidth, sourceHeight, 0, 0, false),
            new Attempt(sourceWidth, sourceHeight, 0, 0, true)
        };

        StringBuilder errors = new StringBuilder();
        for (Attempt attempt : attempts) {
            if (attempt.xOffset + attempt.width > sourceWidth || attempt.yOffset + attempt.height > sourceHeight) {
                continue;
            }
            try {
                byte[] raw = toRaw(image, attempt);
                Engine engine = UareUGlobal.GetEngine();
                Fmd fmd = engine.CreateFmd(raw, attempt.width, attempt.height, 500, 0, 0, Fmd.Format.ANSI_378_2004);
                System.out.println("{"
                    + "\"success\":true,"
                    + "\"format\":\"ANSI_378_2004\","
                    + "\"width\":" + attempt.width + ","
                    + "\"height\":" + attempt.height + ","
                    + "\"x_offset\":" + attempt.xOffset + ","
                    + "\"y_offset\":" + attempt.yOffset + ","
                    + "\"invert\":" + attempt.invert + ","
                    + "\"fmd\":\"" + Base64.getEncoder().encodeToString(fmd.getData()) + "\""
                    + "}");
                return;
            } catch (UareUException error) {
                errors.append("width=").append(attempt.width)
                    .append(",x=").append(attempt.xOffset)
                    .append(",y=").append(attempt.yOffset)
                    .append(",invert=").append(attempt.invert)
                    .append(": code=").append(error.getCode())
                    .append(" ").append(error)
                    .append("; ");
            }
        }

        printError("Konversi FMD gagal. " + errors);
        System.exit(1);
    }

    private static byte[] toRaw(BufferedImage image, Attempt attempt) {
        byte[] raw = new byte[attempt.width * attempt.height];
        for (int y = 0; y < attempt.height; y++) {
            for (int x = 0; x < attempt.width; x++) {
                int rgb = image.getRGB(x + attempt.xOffset, y + attempt.yOffset);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                int gray = (r + g + b) / 3;
                raw[y * attempt.width + x] = (byte)(attempt.invert ? 255 - gray : gray);
            }
        }
        return raw;
    }

    private static void printError(String message) {
        System.out.println("{\"success\":false,\"error\":\"" + json(message) + "\"}");
    }

    private static String json(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }
}
