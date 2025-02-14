import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFilePromise = promisify(execFile);

export async function convertSvgToPng(inputPath: string, outputPath: string, scale: number = 1): Promise<void> {
  try {
    // Create temporary directory for output
    const tempDir = path.join(path.dirname(outputPath), ".temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Use qlmanage to convert
    await execFilePromise("/usr/bin/qlmanage", ["-t", "-s", `${1000 * scale}`, "-o", tempDir, inputPath]);

    // qlmanage creates a file with .png extension in the temp directory
    const inputFileName = path.basename(inputPath);
    const tempOutputPath = path.join(tempDir, `${inputFileName}.png`);

    // Move the file to final destination
    if (fs.existsSync(tempOutputPath)) {
      await execFilePromise("/bin/mv", [tempOutputPath, outputPath]);
    } else {
      throw new Error("Converted file not found");
    }

    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Conversion error:", error);
    throw new Error(`Failed to convert SVG: ${error}`);
  }
}
