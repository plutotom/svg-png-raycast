import {
  Action,
  ActionPanel,
  Form,
  Icon,
  showToast,
  Toast,
  open,
  getPreferenceValues,
  showHUD,
  Detail,
} from "@raycast/api";
import { useState, useEffect } from "react";
import fs from "fs";
import path from "path";
import { createCanvas, Image } from "canvas";
import { JSDOM } from "jsdom";

interface FormValues {
  svgFile: string;
  scale: string;
  customScale?: string;
}

interface Preferences {
  defaultOutputPath: string;
}

function scaleSvg(svgContent: string, scale: number): string {
  const dom = new JSDOM();
  const parser = new dom.window.DOMParser();
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const svgElement = svgDoc.documentElement;

  const width = parseInt(svgElement.getAttribute("width") ?? "300");
  const height = parseInt(svgElement.getAttribute("height") ?? "150");

  const scaledWidth = width * scale;
  const scaledHeight = height * scale;

  svgElement.setAttribute("width", scaledWidth.toString());
  svgElement.setAttribute("height", scaledHeight.toString());

  return svgDoc.documentElement.outerHTML;
}

async function convertSvgToPng(svgPath: string, scale: number): Promise<string> {
  try {
    const preferences = getPreferenceValues<Preferences>();
    const svgContent = await fs.promises.readFile(svgPath, "utf8");

    // Scale the SVG
    const scaledSvg = scaleSvg(svgContent, scale);

    // Generate output filename
    const fileName = path.basename(svgPath, ".svg");
    const outputPath = path.join(preferences.defaultOutputPath, `${fileName}-${scale}x.png`);

    // Replace browser canvas with node-canvas
    const canvas = createCanvas(100, 100); // Initial size, will be updated
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Set up image loading
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Save as PNG
        const dataUrl = canvas.toDataURL("image/png");
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");

        fs.writeFileSync(outputPath, base64Data, "base64");
        resolve(outputPath);
      };
      img.onerror = reject;
      img.src = `data:image/svg+xml;base64,${Buffer.from(scaledSvg).toString("base64")}`;
    });
  } catch (error) {
    throw new Error(`Failed to convert SVG: ${error}`);
  }
}

export default function Command() {
  const [isConverting, setIsConverting] = useState(false);

  async function handleSubmit(values: FormValues) {
    try {
      setIsConverting(true);
      const scale = values.scale === "custom" ? parseFloat(values.customScale || "1") : parseFloat(values.scale);

      const toast = await showToast({
        style: Toast.Style.Animated,
        title: "Converting SVG to PNG...",
      });

      const outputPath = await convertSvgToPng(values.svgFile, scale);

      toast.style = Toast.Style.Success;
      toast.title = "Conversion Complete";
      toast.message = "PNG file has been created";

      await showHUD("✅ SVG converted successfully!");
      await open(outputPath);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Conversion Failed",
        message: String(error),
      });
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Convert SVG" icon={Icon.Download} onSubmit={handleSubmit} />
        </ActionPanel>
      }
      isLoading={isConverting}
    >
      <Form.FilePicker
        id="svgFile"
        title="SVG File"
        allowMultipleSelection={false}
        canChooseDirectories={false}
        // allowedExtensions={["svg"]}
      />
      <Form.Dropdown id="scale" title="Scale Factor" defaultValue="1">
        <Form.Dropdown.Item value="1" title="1x" />
        <Form.Dropdown.Item value="2" title="2x" />
        <Form.Dropdown.Item value="4" title="4x" />
        <Form.Dropdown.Item value="8" title="8x" />
        <Form.Dropdown.Item value="16" title="16x" />
        <Form.Dropdown.Item value="32" title="32x" />
        <Form.Dropdown.Item value="64" title="64x" />
        <Form.Dropdown.Item value="custom" title="Custom..." />
      </Form.Dropdown>
      <Form.TextField id="customScale" title="Custom Scale" placeholder="Enter custom scale (e.g., 1.5)" />
    </Form>
  );
}
