import { ActionPanel, Action, List, showToast, Toast, getPreferenceValues, Icon } from "@raycast/api";
import { useState, useEffect } from "react";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { convertSvgToPng } from "./utils/svg-converter";

interface Preferences {
  defaultOutputPath: string;
}

interface SVGFile {
  path: string;
  name: string;
  modifiedTime: Date;
}

// Recursive function to find all SVG files
async function findSvgFiles(dir: string): Promise<SVGFile[]> {
  const readdir = promisify(fs.readdir);
  const stat = promisify(fs.stat);
  const files = await readdir(dir);
  const svgFiles: SVGFile[] = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = await stat(filePath);

    if (stats.isDirectory()) {
      // Recursively search subdirectories
      const subDirFiles = await findSvgFiles(filePath);
      svgFiles.push(...subDirFiles);
    } else if (path.extname(file).toLowerCase() === ".svg") {
      svgFiles.push({
        path: filePath,
        name: file,
        modifiedTime: stats.mtime,
      });
    }
  }

  return svgFiles;
}

function ConversionView({ svgFile }: { svgFile: SVGFile }) {
  const [scale, setScale] = useState("1");
  const preferences = getPreferenceValues<Preferences>();

  async function handleConversion() {
    try {
      const outputPath = path.join(
        preferences.defaultOutputPath,
        `${path.basename(svgFile.name, ".svg")}-${scale}x.png`,
      );

      await showToast({ style: Toast.Style.Animated, title: "Converting SVG..." });

      await convertSvgToPng(svgFile.path, outputPath, parseFloat(scale));

      await showToast({
        style: Toast.Style.Success,
        title: "Conversion Complete",
        message: "PNG file has been created",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Conversion Failed",
        message: String(error),
      });
    }
  }

  return (
    <List>
      <List.Item
        title={`Convert ${svgFile.name}`}
        subtitle="Choose scale factor and convert"
        accessories={[{ text: `Scale: ${scale}x` }]}
        actions={
          <ActionPanel>
            <ActionPanel.Section>
              <Action title="Convert" onAction={handleConversion} icon={Icon.Download} />
            </ActionPanel.Section>
            <ActionPanel.Section>
              {[
                { scale: 1, key: "1" },
                { scale: 2, key: "2" },
                { scale: 4, key: "4" },
                { scale: 8, key: "8" },
                { scale: 16, key: "i" },
                { scale: 32, key: "t" },
                { scale: 64, key: "x" },
              ].map(({ scale: scaleOption, key }) => (
                <Action
                  key={scaleOption}
                  title={`Set Scale ${scaleOption}x`}
                  onAction={() => setScale(scaleOption.toString())}
                  shortcut={{ modifiers: ["cmd"], key: key as KeyEquivalent }}
                />
              ))}
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    </List>
  );
}

export default function Command() {
  const [svgFiles, setSvgFiles] = useState<SVGFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const preferences = getPreferenceValues<Preferences>();

  useEffect(() => {
    async function loadSvgFiles() {
      try {
        const files = await findSvgFiles(preferences.defaultOutputPath);
        // Sort files by most recently modified
        files.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
        setSvgFiles(files);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load SVG files",
          message: String(error),
        });
      } finally {
        setIsLoading(false);
      }
    }

    void loadSvgFiles();
  }, []);

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search SVG files..." throttle>
      {svgFiles.map((file) => (
        <List.Item
          key={file.path}
          icon={Icon.Document}
          title={file.name}
          subtitle={path.relative(preferences.defaultOutputPath, path.dirname(file.path))}
          accessories={[
            {
              text: new Date(file.modifiedTime).toLocaleDateString(),
              tooltip: `Modified: ${file.modifiedTime.toLocaleString()}`,
            },
          ]}
          actions={
            <ActionPanel>
              <Action.Push title="Convert to PNG" target={<ConversionView svgFile={file} />} icon={Icon.Download} />
              <Action.ShowInFinder path={file.path} shortcut={{ modifiers: ["cmd"], key: "f" }} />
              <Action.CopyToClipboard
                title="Copy Path"
                content={file.path}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
